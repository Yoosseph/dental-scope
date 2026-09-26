/**
 * The imperative 3D engine. Owns Three.js; subscribes to the app store;
 * never triggers React renders per frame. See docs/architecture.md §6.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Registry } from '../anatomy/registry';
import type { Structure } from '../anatomy/types';
import { formatTooth } from '../anatomy/notation';
import { store, getState, setState, actions, type AppState, type ViewPreset } from '../state/store';
import { resolveMesh, revealPatch, layersActive, type MeshVisual } from '../state/visibility';
import { Animator } from './animator';
import { AssetLoader } from './assets';
import { CameraRig } from './camera';
import { archOffset, toothLayerOffset } from './explode';
import { boardSlot, shelfLayout, type LayoutItem } from './layout';
import { LabelLayer, type LabelCandidate } from './labels';
import { HOVER, HIGHLIGHT, THEME_LIGHTING, applyThemeToMaterial, createTissueMaterial, setFibreAxis, setMaterialOpacity, styleKeyFor, type SceneTheme, type TissueMaterial } from './materials';
import { SectionTool } from './section';

interface MeshEntry {
  key: string;
  owner: string;
  mesh: THREE.Mesh<THREE.BufferGeometry, TissueMaterial>;
  archOffset: THREE.Vector3;
  toothOffset: THREE.Vector3;
  visual: MeshVisual;
  opacity: number; // animated
  hi: number; // animated highlight
  hiTarget: number;
  hover: boolean;
  labelPoint?: THREE.Vector3; // geometry-space label anchor
  /** phase-2 board slot (world offset) and the eased current offset */
  boardTarget?: THREE.Vector3;
  boardPos?: THREE.Vector3;
}

const STAGES = [
  { id: 'core', file: 'core.glb', label: 'Jaws & dentition' },
  { id: 'context', file: 'context.glb', label: 'Skull & muscles' },
  { id: 'neurovascular', file: 'neurovascular.glb', label: 'Nerves & vessels' },
] as const;

const EXEMPLAR_TOOTH = 36;

export class Engine {
  readonly registry: Registry;
  readonly scene = new THREE.Scene();
  readonly animator = new Animator();
  readonly section = new SectionTool();
  renderer!: THREE.WebGLRenderer;
  rig!: CameraRig;
  labels!: LabelLayer;

  private container!: HTMLElement;
  private overlay!: HTMLElement;
  private tip!: HTMLElement;
  private entries = new Map<string, MeshEntry>();
  private loader = new AssetLoader();
  private loadedTeeth = new Set<number>();
  private toothLoads = new Map<number, Promise<void>>();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerPx = { x: 0, y: 0 };
  private pointerDirty = false;
  private pointerInside = false;
  private down: { x: number; y: number; t: number } | null = null;
  private needsRender = true;
  private lastT = performance.now();
  private raf = 0;
  private unsub: (() => void)[] = [];
  private explodeCur = 0;
  private toothExplodeCur = 0;
  /** 0…1 blend from the in-position explode (phase 1) to the laid-out board (phase 2) */
  private phaseCur = 0;
  private boardTimer = 0;
  private boardAspect = 1;
  private explodeTimer = 0;
  /** canvas area covered by panels (px), animated; shifts the optical centre */
  private insets = { right: 0, bottom: 0 };
  private marker: THREE.Mesh;
  private root = new THREE.Group();
  private sceneBounds = new THREE.Box3();
  private resizeObs?: ResizeObserver;
  private disposed = false;

  constructor(registry: Registry) {
    this.registry = registry;
    this.marker = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14),
      new THREE.MeshBasicMaterial({ color: HIGHLIGHT, depthTest: false, transparent: true, opacity: 0.95 }),
    );
    this.marker.renderOrder = 1000;
    this.marker.visible = false;
    const key = new THREE.DirectionalLight('#fff7ec', 1.6);
    key.position.set(4, 8, 7);
    const fill = new THREE.DirectionalLight('#dfe9ff', 0.55);
    fill.position.set(-6, 2, 4);
    const rim = new THREE.DirectionalLight('#ffffff', 0.5);
    rim.position.set(0, 3, -8);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8b8478', 0.55), key, fill, rim);
    this.scene.add(this.root, this.marker, this.section.outline);
    const [lo, hi] = registry.manifest.bounds;
    this.sceneBounds.set(new THREE.Vector3(...lo).min(new THREE.Vector3(...hi)), new THREE.Vector3(...lo).max(new THREE.Vector3(...hi)));
  }

  /* ================================================================ setup */

  mount(container: HTMLElement) {
    this.disposed = false;
    this.container = container;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    const mobile = matchMedia('(pointer: coarse)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.localClippingEnabled = true;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = 'ds-canvas';
    renderer.domElement.setAttribute('aria-label', '3D view of dental anatomy. Drag to orbit, scroll to zoom, click a structure to inspect it.');
    renderer.domElement.setAttribute('role', 'img');
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.overlay = document.createElement('div');
    this.overlay.className = 'ds-overlay';
    container.appendChild(this.overlay);
    this.tip = document.createElement('div');
    this.tip.className = 'ds-tip';
    this.tip.setAttribute('aria-hidden', 'true');
    this.overlay.appendChild(this.tip);

    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.applyTheme(getState().theme);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 200);
    this.rig = new CameraRig(camera, renderer.domElement, this.animator);
    this.rig.setMode(getState().orbitMode);
    this.rig.onUserInteract = () => {
      if (getState().view) setState({ view: null });
    };
    this.rig.controls.addEventListener('change', () => this.invalidate());
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    // ?motion=reduce forces reduced motion (useful for screenshots and slow devices)
    this.animator.reducedMotion = reduce.matches || new URLSearchParams(location.search).get('motion') === 'reduce';
    reduce.addEventListener?.('change', (e) => (this.animator.reducedMotion = e.matches));

    // initial framing: the dentition, three-quarter view
    const sphere = this.sceneBounds.getBoundingSphere(new THREE.Sphere());
    this.rig.home = { target: sphere.center.clone().add(new THREE.Vector3(0, -0.15, -0.2)), radius: sphere.radius * 1.28 };
    this.updatePivot();
    this.resize();
    this.rig.preset('three-quarter', this.rig.home.target, this.rig.home.radius, 0);

    this.labels = new LabelLayer(this.overlay);
    this.labels.onClick = (id) => this.selectFromUI(id, { focus: false });
    this.labels.raycastOwner = (from, to) => this.raycastOwner(from, to);
    this.labels.keeps = (p) => !getState().clip.enabled || this.section.keeps(p);

    this.bindPointer();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.unsub.push(store.subscribe((s, prev) => this.onState(s, prev)));
    this.loop();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.boardTimer);
    clearTimeout(this.explodeTimer);
    this.unsub.forEach((u) => u());
    this.resizeObs?.disconnect();
    this.labels?.dispose();
    this.rig?.controls.dispose();
    this.scene.environment?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.overlay?.remove();
    this.unsub = [];
  }

  /* ============================================================== loading */

  async loadAll() {
    try {
      for (const st of STAGES) {
        actions.setLoading(st.id, 0);
        const geos = await this.loader.load(st.file, (p) => actions.setLoading(st.id, p));
        this.addGeometries(geos);
        actions.setLoading(st.id, 1);
        if (st.id === 'core') setState({ ready: true });
        this.refreshAll();
        await nextFrame();
      }
      // idle prefetch of the detailed exemplar tooth
      const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 600));
      idle(() => void this.ensureTooth(EXEMPLAR_TOOTH));
    } catch (e) {
      console.error(e);
      setState({ error: 'The 3D anatomy could not be loaded. Check your connection and reload.' });
    }
  }

  ensureTooth(fdi: number): Promise<void> {
    if (this.loadedTeeth.has(fdi)) return Promise.resolve();
    const existing = this.toothLoads.get(fdi);
    if (existing) return existing;
    const asset = this.registry.get(`tooth-${fdi}`)?.tooth?.asset;
    if (!asset) return Promise.resolve();
    const p = this.loader.load(asset).then((geos) => {
      this.addGeometries(geos);
      this.loadedTeeth.add(fdi);
      this.refreshAll();
    });
    this.toothLoads.set(fdi, p);
    return p;
  }

  async ensureAllTeeth() {
    const teeth = this.registry.teeth().map((t) => t.toothFdi!);
    let done = 0;
    actions.setLoading('teeth', 0);
    await Promise.all(
      teeth.map((f) =>
        this.ensureTooth(f).then(() => {
          done++;
          actions.setLoading('teeth', done / teeth.length);
        }),
      ),
    );
  }

  private addGeometries(geos: Map<string, THREE.BufferGeometry>) {
    for (const [key, geo] of geos) {
      if (this.entries.has(key)) continue;
      const owner = this.registry.meshOwner.get(key);
      if (!owner) continue;
      const cats = this.registry.categoriesOfMesh(key);
      const mat = createTissueMaterial(styleKeyFor(key, cats));
      applyThemeToMaterial(mat, getState().theme);
      setFibreAxis(mat, geo.boundingBox!);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = key;
      mesh.userData.key = key;
      mesh.visible = false;
      const center = geo.boundingBox!.getCenter(new THREE.Vector3());
      const entry: MeshEntry = {
        key,
        owner,
        mesh,
        archOffset: archOffset(this.registry, key, center),
        toothOffset: toothLayerOffset(this.registry, key),
        visual: 'off',
        opacity: 0,
        hi: 0,
        hiTarget: 0,
        hover: false,
      };
      this.entries.set(key, entry);
      this.root.add(mesh);
    }
  }

  /* ========================================================= state sync */

  /** Fixed-orbit centre: the tooth being dissected, otherwise the dentition (camera home). */
  private updatePivot() {
    const { dissectFdi } = getState();
    const tooth = dissectFdi !== null ? this.boundsOf(`tooth-${dissectFdi}`, false) : null;
    this.rig.setPivot(tooth && !tooth.isEmpty() ? tooth.getCenter(new THREE.Vector3()) : this.rig.home.target);
    this.invalidate();
  }

  /** Match lighting and bone shading to the UI theme (see THEME_LIGHTING). */
  private applyTheme(theme: SceneTheme) {
    this.renderer.toneMappingExposure = THEME_LIGHTING[theme].exposure;
    this.scene.environmentIntensity = THEME_LIGHTING[theme].environment;
    for (const e of this.entries.values()) applyThemeToMaterial(e.mesh.material, theme);
    this.invalidate();
  }

  private onState(s: AppState, p: AppState) {
    const visChanged =
      s.categories !== p.categories ||
      s.hidden !== p.hidden ||
      s.ghosted !== p.ghosted ||
      s.isolateId !== p.isolateId ||
      s.isolateContext !== p.isolateContext ||
      s.dissectFdi !== p.dissectFdi ||
      s.dissectLevel !== p.dissectLevel ||
      s.clip.enabled !== p.clip.enabled ||
      s.ghostOpacity !== p.ghostOpacity;
    if (visChanged) this.refreshVisibility();
    if (s.selectedId !== p.selectedId || s.hoveredId !== p.hoveredId || s.dissectFdi !== p.dissectFdi) this.refreshHighlight();
    if (s.clip !== p.clip || s.dissectFdi !== p.dissectFdi) this.refreshClip();
    if (s.clip.enabled && !p.clip.enabled && s.dissectFdi === null) void this.ensureAllTeeth();
    if (s.dissectFdi !== p.dissectFdi && s.dissectFdi !== null) void this.ensureTooth(s.dissectFdi);
    if (s.autoRotate !== p.autoRotate) this.rig.controls.autoRotate = s.autoRotate;
    if (s.theme !== p.theme) this.applyTheme(s.theme);
    if (s.orbitMode !== p.orbitMode) this.rig.setMode(s.orbitMode);
    if (s.dissectFdi !== p.dissectFdi) this.updatePivot();
    if (visChanged || s.labels !== p.labels || s.numbering !== p.numbering || s.selectedId !== p.selectedId) this.refreshLabels();
    // a new phase or a changed set of visible structures re-packs the board and frames it
    if (s.explodePhase !== p.explodePhase || (s.explodePhase === 2 && visChanged)) this.layoutBoard(true);
    if (s.explodePhase === 1 && p.explodePhase === 2 && s.dissectFdi === null && !s.isolateId) {
      // back from the board: frame the in-position dissection again
      this.rig.preset('three-quarter', this.rig.home.target, this.explodedHomeRadius(s.explode), 0.8);
      if (s.view !== 'three-quarter') setState({ view: 'three-quarter' });
    } else if (s.explode !== p.explode && s.explodePhase === 1) this.reframeForExplode(s);
    this.invalidate();
  }

  /**
   * Phase 2: lay every fully visible structure out on a board facing the viewer
   * (see layout.ts); ghosted context fades out. `frame` also points the camera at it.
   */
  private layoutBoard(frame: boolean) {
    clearTimeout(this.boardTimer);
    clearTimeout(this.explodeTimer);
    if (getState().explodePhase !== 2) return;
    const items: LayoutItem[] = [];
    const boxes = new Map<string, THREE.Box3>();
    for (const e of this.entries.values()) {
      if (e.visual !== 'on') {
        e.boardTarget = e.boardPos = undefined;
        continue;
      }
      const box = e.mesh.geometry.boundingBox!;
      boxes.set(e.key, box);
      const size = box.getSize(new THREE.Vector3());
      items.push({ key: e.key, w: size.x, h: size.y, ...boardSlot(e.key, this.registry.categoriesOfMesh(e.key), this.registry.get(e.owner)?.toothFdi) });
    }
    const { centers, bounds } = shelfLayout(items, this.rig.camera.aspect, 0.35);
    this.boardAspect = this.rig.camera.aspect;
    const origin = this.rig.home.target;
    for (const [key, c] of centers) {
      const e = this.entries.get(key)!;
      const center = boxes.get(key)!.getCenter(new THREE.Vector3());
      e.boardTarget = new THREE.Vector3(origin.x + c.x, origin.y + c.y, origin.z).sub(center);
      // new slots are taken directly (the move from phase 1 is blended by phaseCur);
      // existing ones glide to their new place in tickVisuals
      e.boardPos ??= e.boardTarget.clone();
      if (this.phaseCur < 1e-3) e.boardPos.copy(e.boardTarget);
    }
    if (frame) {
      // fit the board rectangle (not its bounding sphere); the margin keeps it clear of the
      // side panels, the dock and the mobile bar
      const cam = this.rig.camera;
      const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
      const halfW = (bounds.x1 - bounds.x0) / 2;
      const halfH = (bounds.y1 - bounds.y0) / 2;
      const distance = Math.max((halfH * 1.5) / tanV, (halfW * 1.45) / (tanV * cam.aspect));
      setState({ view: null });
      this.rig.focusSphere(new THREE.Vector3(origin.x, origin.y, origin.z), Math.hypot(halfW, halfH), { direction: new THREE.Vector3(0, 0.02, 1), distance, duration: 0.9 });
    }
    this.invalidate();
  }

  /** While a view preset is active, widen the framing so the exploded anatomy stays in view. */
  private reframeForExplode(s: AppState) {
    if (!s.view || s.dissectFdi !== null || s.isolateId) return;
    const view = s.view;
    clearTimeout(this.explodeTimer);
    this.explodeTimer = window.setTimeout(() => {
      this.rig.preset(view, this.rig.home.target, this.explodedHomeRadius(getState().explode), 0.6);
    }, 120);
  }

  /** Home framing radius widened for the arch explode (up to +75 % when fully exploded). */
  private explodedHomeRadius(explode: number): number {
    return this.rig.home.radius * (1 + 0.75 * explode);
  }

  private refreshAll() {
    this.refreshVisibility();
    this.refreshHighlight();
    this.refreshClip();
    this.refreshLabels();
    // geometry that arrives while the board is shown gets a slot too
    if (getState().explodePhase === 2) this.layoutBoard(false);
  }

  private visibilityCtx() {
    return { registry: this.registry, state: getState(), loadedTeeth: this.loadedTeeth };
  }

  private refreshVisibility() {
    const ctx = this.visibilityCtx();
    for (const e of this.entries.values()) e.visual = resolveMesh(e.key, ctx);
    this.invalidate();
  }

  private refreshHighlight() {
    const { selectedId, hoveredId, dissectFdi } = getState();
    // inside a tooth, selecting the tooth itself shouldn't tint every layer
    const tintSel = selectedId && !(dissectFdi !== null && selectedId === `tooth-${dissectFdi}`);
    const sel = new Set(tintSel ? this.highlightMeshes(selectedId) : []);
    const hov = new Set(hoveredId && hoveredId !== selectedId ? this.highlightMeshes(hoveredId) : []);
    for (const e of this.entries.values()) {
      e.hiTarget = sel.has(e.key) ? 1 : hov.has(e.key) ? 0.55 : 0;
      e.hover = !sel.has(e.key) && hov.has(e.key);
      e.mesh.material.userData.fx.uHiColor.value.copy(e.hover ? HOVER : HIGHLIGHT);
    }
    const s = selectedId ? this.registry.get(selectedId) : undefined;
    this.marker.visible = !!s && s.kind === 'landmark' && !!s.anchor;
    this.invalidate();
  }

  /** Meshes to tint for a structure (landmarks are shown by the marker instead). */
  private highlightMeshes(id: string): string[] {
    const s = this.registry.get(id);
    return s && s.kind !== 'landmark' ? this.registry.meshesOf(id) : [];
  }

  private activeBounds(): THREE.Box3 {
    const { dissectFdi } = getState();
    if (dissectFdi !== null) {
      const b = this.boundsOf(`tooth-${dissectFdi}`, false);
      if (!b.isEmpty()) return b;
    }
    const b = new THREE.Box3();
    for (const e of this.entries.values()) {
      const cats = this.registry.categoriesOfMesh(e.key);
      if (cats.includes('skull') || cats.includes('muscles')) continue;
      b.union(e.mesh.geometry.boundingBox!);
    }
    return b.isEmpty() ? this.sceneBounds : b;
  }

  private refreshClip() {
    const { clip, dissectFdi } = getState();
    const frame = dissectFdi !== null ? this.registry.get(`tooth-${dissectFdi}`)?.tooth?.frame : undefined;
    this.section.setFrame(frame ? { sagittal: frame.buccal, coronal: frame.mesial, axial: frame.axis } : null);
    this.section.update(clip, this.activeBounds(), this.rig.camera, this.rig.controls.target);
    const planes = clip.enabled ? this.section.planes : null;
    for (const e of this.entries.values()) {
      const m = e.mesh.material;
      if ((m.clippingPlanes?.length ?? 0) !== (planes?.length ?? 0)) {
        m.clippingPlanes = planes;
        m.needsUpdate = true;
      }
    }
    this.invalidate();
  }

  /* ============================================================ labels */

  private refreshLabels() {
    if (!this.labels) return;
    const s = getState();
    this.labels.enabled = s.labels;
    this.labels.selectedId = s.selectedId;
    if (!s.labels) {
      this.labels.setCandidates([]);
      this.invalidate();
      return;
    }
    const out: LabelCandidate[] = [];
    const visibleMesh = (k: string) => {
      const e = this.entries.get(k);
      return !!e && e.visual !== 'off';
    };
    const addMeshLabel = (id: string, text: string, kind: LabelCandidate['kind'], prio: number, meshKeys: string[]) => {
      const keys = meshKeys.filter(visibleMesh);
      if (!keys.length) return;
      const e = this.entries.get(keys[0])!;
      const r = e.mesh.geometry.boundingSphere!.radius;
      out.push({
        id,
        text,
        kind,
        priority: prio,
        radius: r,
        owners: new Set([id, ...this.registry.descendants(id).map((d) => d.id), ...keys.map((k) => this.registry.meshOwner.get(k)!)]),
        anchor: () => this.labelAnchor(e),
      });
    };
    if (s.dissectFdi !== null) {
      const fdi = s.dissectFdi;
      const tooth = this.registry.get(`tooth-${fdi}`)!;
      for (const k of tooth.tooth?.layers ?? []) {
        const st = this.registry.get(k);
        if (st && this.entries.get(k)?.visual === 'on') addMeshLabel(k, st.shortName ?? st.name, 'structure', st.labelPriority + 3, [k]);
      }
      for (const d of this.registry.descendants(tooth.id)) {
        if (d.kind !== 'landmark' || !d.anchor || d.id.startsWith('pulp-horn-') && !d.id.startsWith('pulp-horn-1-')) continue;
        const parentKey = d.parent && this.registry.get(d.parent)?.meshes[0];
        const parentEntry = parentKey ? this.entries.get(parentKey) : undefined;
        if (parentEntry && parentEntry.visual === 'off') continue;
        const anchor = new THREE.Vector3(...d.anchor);
        out.push({
          id: d.id,
          text: d.shortName ?? d.name,
          kind: 'landmark',
          priority: d.labelPriority + 2,
          radius: 0.2,
          owners: new Set([d.id, ...(parentKey ? [this.registry.meshOwner.get(parentKey)!] : [])]),
          anchor: () => (parentEntry ? anchor.clone().add(parentEntry.mesh.position) : anchor),
        });
      }
    } else {
      for (const t of this.registry.teeth()) {
        const fdi = t.toothFdi!;
        const keys = layersActive(fdi, this.visibilityCtx()) ? [`enamel-${fdi}`] : [t.id];
        addMeshLabel(t.id, formatTooth(fdi, s.numbering), 'tooth', 5, keys);
      }
      for (const st of this.registry.byId.values()) {
        if (st.toothFdi !== undefined || st.labelPriority < 3) continue;
        if (st.kind === 'mesh') {
          const vis = st.meshes.filter((k) => this.entries.get(k)?.visual === 'on');
          if (vis.length) addMeshLabel(st.id, st.shortName ?? st.name, 'structure', st.labelPriority, vis);
        } else if (st.kind === 'landmark' && st.anchor) {
          const ok = st.categories.every((c) => s.categories[c] !== 'off');
          if (!ok) continue;
          const a = new THREE.Vector3(...st.anchor);
          const jaw = this.entries.get('mandible-body');
          out.push({ id: st.id, text: st.name, kind: 'landmark', priority: st.labelPriority, radius: 0.35, owners: new Set([st.id]), anchor: () => (jaw ? a.clone().add(jaw.mesh.position) : a) });
        }
      }
    }
    this.labels.setCandidates(out);
    this.invalidate();
  }

  private labelAnchor(e: MeshEntry): THREE.Vector3 {
    if (!e.labelPoint) e.labelPoint = computeLabelPoint(e, this.registry);
    return e.labelPoint.clone().add(e.mesh.position);
  }

  /* ========================================================== picking */

  private bindPointer() {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointermove', (ev) => {
      this.setPointer(ev);
      this.pointerInside = true;
      this.pointerDirty = true;
      this.invalidate();
    });
    dom.addEventListener('pointerleave', () => {
      this.pointerInside = false;
      actions.hover(null);
      this.tip.classList.remove('is-visible');
    });
    dom.addEventListener('pointerdown', (ev) => {
      this.down = { x: ev.clientX, y: ev.clientY, t: performance.now() };
    });
    dom.addEventListener('pointerup', (ev) => {
      const d = this.down;
      this.down = null;
      if (!d) return;
      const moved = Math.hypot(ev.clientX - d.x, ev.clientY - d.y);
      if (moved > 6 || performance.now() - d.t > 600) return;
      this.setPointer(ev);
      const hit = this.pick();
      if (hit) this.selectFromUI(hit, { focus: false, reveal: false });
      else actions.select(null);
    });
    dom.addEventListener('dblclick', (ev) => {
      this.setPointer(ev);
      const hit = this.pick();
      if (hit) this.focus(hit);
    });
  }

  private setPointer(ev: PointerEvent | MouseEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointerPx = { x: ev.clientX - r.left, y: ev.clientY - r.top };
    this.pointer.set((this.pointerPx.x / r.width) * 2 - 1, -(this.pointerPx.y / r.height) * 2 + 1);
  }

  private pickables(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const e of this.entries.values()) if (e.mesh.visible && e.visual !== 'off') out.push(e.mesh);
    return out;
  }

  /** Entries hit by the current raycaster ray, nearest first, skipping parts cut away by the section. */
  private *rayHits(): Generator<{ entry: MeshEntry; distance: number }> {
    const clip = getState().clip.enabled;
    for (const h of this.raycaster.intersectObjects(this.pickables(), false)) {
      if (clip && !this.section.keeps(h.point)) continue;
      const entry = this.entries.get(h.object.userData.key as string);
      if (entry) yield { entry, distance: h.distance };
    }
  }

  /** Structure id under the pointer: first opaque hit; ghosts only if nothing opaque is hit. */
  private pick(): string | null {
    this.raycaster.setFromCamera(this.pointer, this.rig.camera);
    let ghost: string | null = null;
    for (const { entry } of this.rayHits()) {
      if (entry.visual === 'on') return entry.owner;
      ghost ??= entry.owner;
    }
    return ghost;
  }

  private raycastOwner(from: THREE.Vector3, to: THREE.Vector3): { id: string; distance: number } | null {
    this.raycaster.set(from, to.clone().sub(from).normalize());
    for (const { entry, distance } of this.rayHits()) if (entry.visual === 'on') return { id: entry.owner, distance };
    return null;
  }

  private updateHover() {
    if (!this.pointerDirty || !this.pointerInside || this.down) return;
    this.pointerDirty = false;
    const id = this.pick();
    actions.hover(id);
    if (id) {
      const s = this.registry.get(id)!;
      const n = getState().numbering;
      const fdi = s.toothFdi;
      this.tip.textContent = fdi ? `${s.name} · ${formatTooth(fdi, n)}` : s.name;
      this.tip.style.transform = `translate3d(${this.pointerPx.x + 14}px, ${this.pointerPx.y + 16}px, 0)`;
      this.tip.classList.add('is-visible');
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      this.tip.classList.remove('is-visible');
      this.renderer.domElement.style.cursor = '';
    }
  }

  /* ========================================================= commands */

  /**
   * Select a structure as if chosen from search/tree/deep link:
   * reveal it, load what it needs, fly to it and open its panel.
   */
  async selectFromUI(id: string, opts: { focus?: boolean; reveal?: boolean } = {}) {
    const s = this.registry.get(id);
    if (!s) return;
    const { focus = true, reveal = true } = opts;
    const fdi = s.toothFdi;
    const isToothPart = fdi !== undefined && s.id !== `tooth-${fdi}`;
    if (reveal) setState(revealPatch(this.registry, id, getState()));
    if (isToothPart && getState().dissectFdi !== fdi && !(getState().clip.enabled && this.loadedTeeth.has(fdi))) {
      actions.enterDissect(fdi);
      // pick a dissection level that shows the structure
      const lvl = levelShowing(id);
      actions.setDissectLevel(lvl);
    } else if (isToothPart && getState().dissectFdi === fdi) {
      const lvl = levelShowing(id);
      if (!levelShows(getState().dissectLevel, id)) actions.setDissectLevel(lvl);
    }
    if (fdi !== undefined) await this.ensureTooth(fdi);
    actions.select(id);
    if (focus) this.focus(id);
  }

  focus(id: string) {
    const s = this.registry.get(id);
    if (!s) return;
    const fdi = s.toothFdi;
    let dir: THREE.Vector3 | undefined;
    if (fdi !== undefined && s.tooth?.frame) {
      const f = s.tooth.frame;
      dir = new THREE.Vector3(...f.buccal).multiplyScalar(0.9).add(new THREE.Vector3(...f.axis).multiplyScalar(0.35)).add(new THREE.Vector3(0, 0, 0.25));
    } else if (fdi !== undefined) {
      const f = this.registry.get(`tooth-${fdi}`)?.tooth?.frame;
      if (f) dir = new THREE.Vector3(...f.buccal).add(new THREE.Vector3(...f.axis).multiplyScalar(0.25));
    }
    const landmark = s.kind === 'landmark' ? this.landmarkPosition(s) : null;
    if (landmark) {
      this.rig.focusSphere(landmark, 0.6, { direction: dir });
      return;
    }
    const box = this.boundsOf(id, true);
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const padding = s.kind === 'group' && sphere.radius > 2 ? 1.1 : 1.45;
    this.rig.focusSphere(sphere.center, sphere.radius, { direction: dir, padding });
  }

  /** World position of a landmark: its anchor, moved with its parent mesh (explode offsets). */
  private landmarkPosition(s: Structure): THREE.Vector3 | null {
    if (!s.anchor) return null;
    const parentKey = s.parent ? this.registry.get(s.parent)?.meshes[0] : undefined;
    const pos = new THREE.Vector3(...s.anchor);
    const parent = parentKey ? this.entries.get(parentKey) : undefined;
    return parent ? pos.add(parent.mesh.position) : pos;
  }

  /** World bounds of a structure's meshes (current exploded positions). */
  boundsOf(id: string, visibleOnly: boolean): THREE.Box3 {
    const box = new THREE.Box3();
    const keys = this.registry.meshesOf(id);
    const tmp = new THREE.Box3();
    for (const k of keys) {
      const e = this.entries.get(k);
      if (e) {
        if (visibleOnly && e.visual === 'off' && keys.some((kk) => this.entries.get(kk)?.visual !== 'off')) continue;
        tmp.copy(e.mesh.geometry.boundingBox!).translate(e.mesh.position);
        box.union(tmp);
      } else {
        const m = this.registry.manifest.meshes[k];
        if (m) box.union(new THREE.Box3(new THREE.Vector3(...m.bounds[0]), new THREE.Vector3(...m.bounds[1])));
      }
    }
    const s = this.registry.get(id);
    if (box.isEmpty() && s?.toothFdi !== undefined) return this.boundsOf(`tooth-${s.toothFdi}`, false);
    return box;
  }

  setView(p: ViewPreset) {
    const { dissectFdi, selectedId } = getState();
    setState({ view: p });
    if (dissectFdi !== null) {
      const b = this.boundsOf(`tooth-${dissectFdi}`, false);
      const sph = b.getBoundingSphere(new THREE.Sphere());
      this.rig.preset(p, sph.center, sph.radius * 1.2);
    } else if (selectedId && getState().isolateId) {
      const b = this.boundsOf(selectedId, true);
      const sph = b.getBoundingSphere(new THREE.Sphere());
      this.rig.preset(p, sph.center, sph.radius * 1.2);
    } else {
      this.rig.preset(p);
    }
  }

  /** Default framing: the whole dentition, or the dissected tooth (setView frames it). */
  resetCamera() {
    if (getState().dissectFdi !== null) return this.setView('three-quarter');
    setState({ view: 'three-quarter' });
    this.rig.home_();
  }

  zoom(f: number) {
    this.rig.zoom(f);
  }

  orbit(dx: number, dy: number) {
    this.rig.orbit(dx, dy);
    this.invalidate();
  }

  invalidate() {
    this.needsRender = true;
  }

  /* ============================================================== loop */

  /**
   * Shift the optical centre away from UI that covers the canvas (detail panel,
   * mobile bottom sheet) so the focused anatomy stays visible. Animated.
   */
  setInsets(right: number, bottom: number) {
    const from = { ...this.insets };
    if (from.right === right && from.bottom === bottom) return;
    this.animator.run('insets', 0.35, (k) => {
      this.insets.right = from.right + (right - from.right) * k;
      this.insets.bottom = from.bottom + (bottom - from.bottom) * k;
      this.applyViewOffset();
    });
  }

  private applyViewOffset() {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const cam = this.rig.camera;
    if (this.insets.right || this.insets.bottom) cam.setViewOffset(w, h, this.insets.right / 2, this.insets.bottom / 2, w, h);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    this.invalidate();
  }

  private resize() {
    if (!this.container || !this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h, false);
    this.rig.camera.aspect = w / Math.max(h, 1);
    this.applyViewOffset();
    // re-pack the phase-2 board when the viewport shape really changes (e.g. a phone is rotated),
    // not for small resizes such as a mobile address bar, so the user's own camera move is kept
    if (getState().explodePhase === 2 && Math.abs(Math.log(this.rig.camera.aspect / this.boardAspect)) > 0.2) {
      clearTimeout(this.boardTimer);
      this.boardTimer = window.setTimeout(() => this.layoutBoard(true), 250);
    }
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;

    const controlsMoved = this.rig.controls.update(dt);
    const pivotMoved = this.rig.tick(dt, controlsMoved);
    const controlsChanged = controlsMoved || pivotMoved;
    const animating = this.animator.active;
    this.animator.tick(dt);
    const fx = this.tickVisuals(dt);
    this.updateHover();
    if (controlsChanged || animating) this.rig.updateClipping();
    if (getState().clip.enabled && (controlsChanged || animating)) this.refreshClip();

    if (!(this.needsRender || controlsChanged || animating || fx)) return;
    this.needsRender = false;
    this.renderer.render(this.scene, this.rig.camera);
    const r = this.renderer.domElement;
    this.labels?.update(this.rig.camera, r.clientWidth, r.clientHeight, now, !(controlsChanged || animating || fx));
  };

  /** Animate opacity, highlight, explode offsets and marker. Returns true while anything is moving. */
  private tickVisuals(dt: number): boolean {
    const s = getState();
    let moving = false;
    const k = 1 - Math.exp(-dt * 14);
    const instant = this.animator.reducedMotion;
    const rate = instant ? 1 : k;
    const boardK = instant ? 1 : k * 0.55; // board moves are a little slower

    const ex = s.explode;
    if (Math.abs(this.explodeCur - ex) > 1e-4) {
      this.explodeCur = stepToward(this.explodeCur, ex, rate, 1e-3);
      moving = true;
    }
    const phase = s.explodePhase === 2 ? 1 : 0;
    if (Math.abs(this.phaseCur - phase) > 1e-4) {
      this.phaseCur = stepToward(this.phaseCur, phase, boardK, 1e-3);
      moving = true;
    }
    const tex = s.dissectFdi !== null ? s.toothExplode : 0;
    if (Math.abs(this.toothExplodeCur - tex) > 1e-4) {
      this.toothExplodeCur = stepToward(this.toothExplodeCur, tex, rate, 1e-3);
      moving = true;
    }

    for (const e of this.entries.values()) {
      let target = e.visual === 'on' ? 1 : e.visual === 'ghost' ? s.ghostOpacity : e.visual === 'faint' ? s.ghostOpacity * 0.45 : 0;
      if (s.explodePhase === 2 && !e.boardTarget) target = 0; // context is not laid out: fade it away
      if (Math.abs(e.opacity - target) > 1e-3) {
        e.opacity = stepToward(e.opacity, target, rate, 0.01);
        moving = true;
      }
      const vis = e.opacity > 0.005;
      if (e.mesh.visible !== vis) e.mesh.visible = vis;
      if (vis) {
        setMaterialOpacity(e.mesh.material, e.opacity);
        e.mesh.renderOrder = e.opacity < 0.999 ? 10 : 0;
      }
      if (Math.abs(e.hi - e.hiTarget) > 1e-3) {
        e.hi = stepToward(e.hi, e.hiTarget, instant ? 1 : Math.min(1, k * 1.6), 0.01);
        e.mesh.material.userData.fx.uHi.value = e.hi;
        moving = true;
      }
      const toothPart = s.dissectFdi !== null && this.registry.get(e.owner)?.toothFdi === s.dissectFdi;
      e.mesh.position.copy(e.archOffset).multiplyScalar(this.explodeCur);
      if (toothPart) e.mesh.position.addScaledVector(e.toothOffset, this.toothExplodeCur);
      if (e.boardPos && this.phaseCur > 0) {
        if (e.boardTarget && e.boardPos.distanceToSquared(e.boardTarget) > 1e-8) {
          e.boardPos.lerp(e.boardTarget, boardK);
          moving = true;
        }
        e.mesh.position.lerp(e.boardPos, this.phaseCur);
      }
    }

    const st = this.marker.visible && s.selectedId ? this.registry.get(s.selectedId) : undefined;
    const markerAt = st ? this.landmarkPosition(st) : null;
    if (markerAt) {
      this.marker.position.copy(markerAt);
      const d = this.rig.camera.position.distanceTo(this.marker.position);
      const pulse = 1 + 0.18 * Math.sin(performance.now() / 260);
      this.marker.scale.setScalar(d * 0.0075 * pulse);
      moving = true;
    }
    return moving;
  }
}

/* ------------------------------------------------------------------ helpers */

/** One easing step from `cur` toward `target`, snapping to the target once within `snap`. */
function stepToward(cur: number, target: number, rate: number, snap: number): number {
  const next = cur + (target - cur) * rate;
  return Math.abs(next - target) < snap ? target : next;
}

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(() => r(null)));
}

/** A dissection level at which a given tooth part is fully visible. */
function levelShowing(id: string): number {
  if (id.startsWith('canal-') || id.startsWith('root-canals-') || id.startsWith('apical-')) return 4;
  if (id.startsWith('enamel-') || id.startsWith('crown-') || id.startsWith('cej-')) return 0;
  if (id.startsWith('pdl-') || id.startsWith('cementum-') || id.startsWith('root-') || id.startsWith('apex-')) return 1;
  if (id.startsWith('dentin')) return 2;
  if (id.startsWith('pulp-chamber') || id.startsWith('pulp-horn') || id.startsWith('pulp-')) return 3;
  return 0;
}

function levelShows(level: number, id: string): boolean {
  const want = levelShowing(id);
  if (want >= 3) return level >= 3;
  if (want === 2) return level === 2;
  return level <= 1 || want === level;
}

/** A point on the outer surface of a mesh to anchor its label. */
function computeLabelPoint(e: MeshEntry, registry: Registry): THREE.Vector3 {
  const geo = e.mesh.geometry;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const center = geo.boundingBox!.getCenter(new THREE.Vector3());
  const owner = registry.get(e.owner);
  const fdi = owner?.toothFdi;
  let dir = center.clone().sub(new THREE.Vector3(0, 0, -0.6));
  if (fdi !== undefined) {
    const f = registry.get(`tooth-${fdi}`)?.tooth?.frame;
    if (f) {
      const axis = new THREE.Vector3(...f.axis);
      const buccal = new THREE.Vector3(...f.buccal);
      const kind = e.key.replace(/-\d{2}$/, '');
      const mix: Record<string, [number, number]> = {
        shell: [1, 0.35],
        enamel: [1, 0.3],
        'dentin-coronal': [0.25, 1],
        'dentin-radicular': [-0.45, 1],
        cementum: [-0.8, 1],
        pdl: [-1, 0.4],
        'pulp-chamber': [1, 0.2],
      };
      const [a, b] = mix[e.key === `tooth-${fdi}` ? 'shell' : kind] ?? [0, 0];
      if (a || b) dir = axis.multiplyScalar(a).addScaledVector(buccal, b);
      else {
        // canals: centroid of the mesh
        return center;
      }
    }
  }
  dir.normalize();
  let best = -Infinity;
  const v = new THREE.Vector3();
  const out = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const d = v.clone().sub(center).dot(dir);
    if (d > best) {
      best = d;
      out.copy(v);
    }
  }
  return out;
}
