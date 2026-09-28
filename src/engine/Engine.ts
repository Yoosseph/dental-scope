/**
 * The imperative 3D engine. Owns Three.js; subscribes to the app store;
 * never triggers React renders per frame. See docs/architecture.md §6.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import type { Registry } from '../anatomy/registry';
import type { Structure } from '../anatomy/types';
import { formatTooth } from '../anatomy/notation';
import { nameOf, shortOf } from '../i18n';
import { store, getState, setState, actions, DISSECT_LEVELS, type AppState, type ViewPreset } from '../state/store';
import { levelShowing, levelShows } from '../state/dissectLevels';
import { resolveMesh, revealPatch, layersActive, type MeshVisual } from '../state/visibility';
import { Animator } from './animator';
import { AssetLoader } from './assets';
import { CameraRig, PRESET_DIRS } from './camera';
import { archOffset, isNeurovascular, neurovascularStretch, pulpLayerOffset, toothLayerOffset } from './explode';
import { boardAssemblyKey, boardSlot, shelfLayout, type LayoutItem } from './layout';
import { computeLabelPoint } from './labelPoint';
import { LabelLayer, type LabelCandidate } from './labels';
import { HIGHLIGHT, THEME_LIGHTING, highlightColor, themedColor, applyThemeToMaterial, createTissueMaterial, setFibreAxis, setMaterialOpacity, styleKeyFor, type SceneTheme, type TissueMaterial } from './materials';
import { isSolid, quietLevel, quietOpacity } from './recede';
import { SectionTool } from './section';
import { colorToothShell, shadeEnamelCrevices } from './toothShading';

interface MeshEntry {
  key: string;
  owner: string;
  mesh: THREE.Mesh<THREE.BufferGeometry, TissueMaterial>;
  archOffset: THREE.Vector3;
  toothOffset: THREE.Vector3;
  /** tooth offset on the Root canals level (pulp only) */
  pulpOffset: THREE.Vector3;
  visual: MeshVisual;
  opacity: number; // animated
  hi: number; // animated highlight
  hiTarget: number;
  hover: boolean;
  labelPoint?: THREE.Vector3; // geometry-space label anchor
  /** tooth shells beside a shown gum: how the root is cut while it is in the gum (see refreshRootCuts) */
  rootCut?: { extract: number; collar: number };
  /**
   * Nerve or vessel. `quiet` is how far it has receded into the pale background (0 = full,
   * 1 = quiet): vessels while the jaws are dissected, regional trunks always (see quietTarget).
   */
  nv?: boolean;
  /** trunk outside the dental region (Structure.regional) */
  regional?: boolean;
  /** dental nerve: never recedes */
  nerve?: boolean;
  /** maxillary sinus: an air space, always drawn translucent */
  sinus?: boolean;
  quiet?: number;
  /** phase-2 board slot (world offset) and the eased current offset */
  boardTarget?: THREE.Vector3;
  boardPos?: THREE.Vector3;
}

/** Loading stages in order (their UI names live in Overlays' STAGE_LABEL). */
const STAGES = [
  { id: 'core', file: 'core.glb' },
  { id: 'context', file: 'context.glb' },
  { id: 'neurovascular', file: 'neurovascular.glb' },
] as const;

const EXEMPLAR_TOOTH = 36;

/** Phase-2 board: gap between laid-out parts (cm) and framing margins (height, width). */
const BOARD_GAP = 0.35;
const BOARD_MARGIN = { h: 1.5, w: 1.45 };

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
  private bvhQueue: THREE.BufferGeometry[] = [];
  private bvhScheduled = false;
  private toothExplodeCur = 0;
  /** 0…1 blend from the normal layer separation to the pulp-only one (Root canals level) */
  private pulpModeCur = 0;
  private readonly tmpOffset = new THREE.Vector3();
  /** 0…1 blend from the in-position explode (phase 1) to the laid-out board (phase 2) */
  private phaseCur = 0;
  private boardTimer = 0;
  private boardAspect = 1;
  private explodeTimer = 0;
  /** canvas area covered by panels (px), animated; shifts the optical centre */
  private insets = { right: 0, bottom: 0 };
  /** where the insets are animating to (the start framing fits into this) */
  private insetTarget = { right: 0, bottom: 0 };
  private insetsKnown = false;
  private marker: THREE.Mesh;
  private root = new THREE.Group();
  private sceneBounds = new THREE.Box3();
  /** everything in the manifest (the whole skull), for the start framing */
  private skullBounds = new THREE.Box3();
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
    const key = new THREE.DirectionalLight('#fff7ec', 1.35);
    key.position.set(4, 8, 7);
    const fill = new THREE.DirectionalLight('#dfe9ff', 0.4);
    fill.position.set(-6, 2, 4);
    const rim = new THREE.DirectionalLight('#ffffff', 0.45);
    rim.position.set(0, 3, -8);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8b8478', 0.4), key, fill, rim);
    this.scene.add(this.root, this.marker, this.section.outline);
    const [lo, hi] = registry.manifest.bounds;
    this.sceneBounds.set(new THREE.Vector3(...lo).min(new THREE.Vector3(...hi)), new THREE.Vector3(...lo).max(new THREE.Vector3(...hi)));
    this.skullBounds.copy(this.sceneBounds);
    for (const m of Object.values(registry.manifest.meshes)) {
      if (m.bounds) this.skullBounds.expandByPoint(new THREE.Vector3(...m.bounds[0])).expandByPoint(new THREE.Vector3(...m.bounds[1]));
    }
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

    // initial framing: the whole skull, straight on (see startView)
    const sphere = this.sceneBounds.getBoundingSphere(new THREE.Sphere());
    this.rig.home = { target: sphere.center.clone().add(new THREE.Vector3(0, -0.15, -0.2)), radius: sphere.radius * 1.28 };
    this.updatePivot();
    this.resize();
    this.startView(0);

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
      setState({ error: 'load' }); // shown translated by the loading card
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
      const style = styleKeyFor(key, cats);
      if (style === 'enamel') shadeEnamelCrevices(geo);
      const mat = createTissueMaterial(style);
      const shell = shellFdi(key);
      if (shell !== null) colorToothShell(geo, mat, this.registry, shell);
      applyThemeToMaterial(mat, getState().theme);
      setFibreAxis(mat, geo.boundingBox!);
      // nerves and vessels stretch between the jaws as they separate (per-vertex jaw weight → morph target)
      const jaw = geo.getAttribute('jaw') as THREE.BufferAttribute | undefined;
      if (jaw && isNeurovascular(cats)) {
        const d = neurovascularStretch(this.registry);
        const delta = new Float32Array(jaw.count * 3);
        for (let i = 0; i < jaw.count; i++) {
          const w = jaw.getX(i);
          delta[i * 3] = d.x * w;
          delta[i * 3 + 1] = d.y * w;
          delta[i * 3 + 2] = d.z * w;
        }
        geo.morphAttributes.position = [new THREE.BufferAttribute(delta, 3)];
        geo.morphTargetsRelative = true;
        geo.computeBoundingSphere();
      }
      const mesh = new THREE.Mesh(geo, mat);
      if (geo.morphAttributes.position) {
        mesh.updateMorphTargets();
        mesh.morphTargetInfluences![0] = 0;
      }
      mesh.name = key;
      mesh.userData.key = key;
      // Ray tests (hover, picking, label occlusion) use a bounding-volume tree once it is built:
      // the same hits as the plain test with far fewer triangles checked. The tree describes the
      // rest shape, so nerves and vessels fall back to the plain test while they are stretched.
      mesh.raycast = geo.morphAttributes.position ? morphAwareRaycast : acceleratedRaycast;
      this.bvhQueue.push(geo);
      mesh.visible = false;
      const center = geo.boundingBox!.getCenter(new THREE.Vector3());
      const entry: MeshEntry = {
        key,
        owner,
        mesh,
        nv: isNeurovascular(cats),
        regional: !!this.registry.get(owner)?.regional,
        nerve: cats.includes('nerves'),
        sinus: cats.includes('sinus'),
        quiet: 0,
        archOffset: archOffset(this.registry, key, center),
        toothOffset: toothLayerOffset(this.registry, key),
        pulpOffset: pulpLayerOffset(this.registry, key),
        visual: 'off',
        opacity: 0,
        hi: 0,
        hiTarget: 0,
        hover: false,
      };
      this.entries.set(key, entry);
      this.root.add(mesh);
    }
    this.scheduleBvh();
  }

  /** Build ray-test trees in idle time, a few meshes per slice, so loading never stalls. */
  private scheduleBvh() {
    if (this.bvhScheduled || !this.bvhQueue.length) return;
    this.bvhScheduled = true;
    // a timer rather than requestIdleCallback: while the scene animates the browser may never be idle
    setTimeout(() => {
      const until = performance.now() + 10;
      while (this.bvhQueue.length && performance.now() < until) {
        const geo = this.bvhQueue.shift()!;
        if (!geo.boundsTree && geo.index !== null) geo.boundsTree = new MeshBVH(geo);
      }
      this.bvhScheduled = false;
      if (!this.disposed) this.scheduleBvh();
    }, 30);
  }

  /* ========================================================= state sync */

  /** Fixed-orbit centre: the tooth being dissected, otherwise the dentition (camera home). */
  private updatePivot() {
    const { dissectFdi } = getState();
    const tooth = dissectFdi !== null ? this.boundsOf(`tooth-${dissectFdi}`, false) : null;
    this.rig.setPivot(tooth && !tooth.isEmpty() ? tooth.getCenter(new THREE.Vector3()) : this.rig.home.target);
    this.invalidate();
  }

  /** Is this a maxillary sinus (selecting one turns the maxilla see-through)? */
  private isSinus(id: string | null): boolean {
    return !!id && !!this.registry.get(id)?.categories.includes('sinus');
  }

  /** Match lighting and bone shading to the UI theme (see THEME_LIGHTING). */
  private applyTheme(theme: SceneTheme) {
    this.renderer.toneMappingExposure = THEME_LIGHTING[theme].exposure;
    this.scene.environmentIntensity = THEME_LIGHTING[theme].environment;
    for (const e of this.entries.values()) {
      applyThemeToMaterial(e.mesh.material, theme);
      if (e.quiet) e.mesh.material.color.lerp(QUIET_TINT[theme], QUIET_MIX * e.quiet);
    }
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
      s.explodePhase !== p.explodePhase ||
      s.ghostOpacity !== p.ghostOpacity ||
      (s.selectedId !== p.selectedId && (this.isSinus(s.selectedId) || this.isSinus(p.selectedId)));
    if (visChanged) this.refreshVisibility();
    if (s.explode !== p.explode || s.explodePhase !== p.explodePhase) this.refreshRootCuts(s);
    if (s.selectedId !== p.selectedId || s.hoveredId !== p.hoveredId || s.dissectFdi !== p.dissectFdi) this.refreshHighlight();
    if (s.clip !== p.clip || s.dissectFdi !== p.dissectFdi) this.refreshClip();
    if (s.clip.enabled && !p.clip.enabled && s.dissectFdi === null) void this.ensureAllTeeth();
    if (s.dissectFdi !== p.dissectFdi && s.dissectFdi !== null) void this.ensureTooth(s.dissectFdi);
    if (s.autoRotate !== p.autoRotate) this.rig.controls.autoRotate = s.autoRotate;
    if (s.theme !== p.theme) this.applyTheme(s.theme);
    if (s.orbitMode !== p.orbitMode) this.rig.setMode(s.orbitMode);
    if (s.dissectFdi !== p.dissectFdi) this.updatePivot();
    if (visChanged || s.labels !== p.labels || s.numbering !== p.numbering || s.selectedId !== p.selectedId || s.lang !== p.lang) this.refreshLabels();
    // a new phase or a changed set of visible structures re-packs the board and frames it
    if (s.explodePhase !== p.explodePhase || (s.explodePhase === 2 && visChanged)) this.layoutBoard(true);
    if (s.explodePhase === 1 && p.explodePhase === 2 && s.dissectFdi === null && !s.isolateId) {
      // back from the board: frame the in-position dissection again
      this.reframeForExplode(s, 'three-quarter');
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
    const assemblies = new Map<string, { bounds: THREE.Box3; members: MeshEntry[] }>();
    for (const e of this.entries.values()) {
      if (!isFullyShown(e.visual)) {
        e.boardTarget = e.boardPos = undefined;
        continue;
      }
      const key = boardAssemblyKey(e.key);
      let assembly = assemblies.get(key);
      if (!assembly) {
        assembly = { bounds: new THREE.Box3(), members: [] };
        assemblies.set(key, assembly);
      }
      assembly.bounds.union(e.mesh.geometry.boundingBox!);
      assembly.members.push(e);
    }
    for (const [key, assembly] of assemblies) {
      const size = assembly.bounds.getSize(new THREE.Vector3());
      const owner = this.registry.meshOwner.get(key);
      items.push({ key, w: size.x, h: size.y, ...boardSlot(key, this.registry.categoriesOfMesh(key), owner ? this.registry.get(owner)?.toothFdi : undefined) });
    }
    const { centers, bounds } = shelfLayout(items, this.rig.camera.aspect, BOARD_GAP);
    this.boardAspect = this.rig.camera.aspect;
    const origin = this.rig.home.target;
    for (const [key, c] of centers) {
      const assembly = assemblies.get(key)!;
      const center = assembly.bounds.getCenter(new THREE.Vector3());
      const target = new THREE.Vector3(origin.x + c.x, origin.y + c.y, origin.z).sub(center);
      for (const e of assembly.members) {
        e.boardTarget = target.clone();
        // new slots are taken directly (the move from phase 1 is blended by phaseCur);
        // existing ones glide to their new place in tickVisuals
        e.boardPos ??= target.clone();
        if (this.phaseCur < 1e-3) e.boardPos.copy(target);
      }
    }
    if (frame) {
      // fit the board rectangle (not its bounding sphere); the margin keeps it clear of the
      // side panels, the dock and the mobile bar
      const cam = this.rig.camera;
      const tanV = tanHalfFov(cam);
      const halfW = (bounds.x1 - bounds.x0) / 2;
      const halfH = (bounds.y1 - bounds.y0) / 2;
      const distance = Math.max((halfH * BOARD_MARGIN.h) / tanV, (halfW * BOARD_MARGIN.w) / (tanV * cam.aspect));
      setState({ view: null });
      this.rig.focusSphere(new THREE.Vector3(origin.x, origin.y, origin.z), Math.hypot(halfW, halfH), { direction: new THREE.Vector3(0, 0.02, 1), distance, duration: 0.9 });
    }
    this.invalidate();
  }

  /** Keep the separating jaws in view: fit the camera to the exploded anatomy as the slider moves. */
  private reframeForExplode(s: AppState, preset?: ViewPreset) {
    if (s.dissectFdi !== null || s.isolateId) return;
    clearTimeout(this.explodeTimer);
    this.explodeTimer = window.setTimeout(() => {
      const ex = getState().explode;
      if (ex < 1e-3) {
        this.startView(0.6);
        return;
      }
      const box = this.explodedBounds(ex);
      if (box.isEmpty()) return;
      const cam = this.rig.camera;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const tanV = tanHalfFov(cam);
      // the fixed orbit keeps looking at its pivot, so fit the larger half on either side of it
      const c = this.rig.mode === 'fixed' ? this.rig.pivot : center;
      const halfH = Math.max(box.max.y - c.y, c.y - box.min.y);
      const halfW = Math.max(box.max.x - c.x, c.x - box.min.x);
      // leave room for the bottom toolbar and the side panels
      const fit = Math.max((halfH / tanV) * 1.15, (halfW / (tanV * cam.aspect)) * 1.25);
      const dir = preset ? PRESET_DIRS[preset].clone() : cam.position.clone().sub(this.rig.controls.target).normalize();
      this.rig.focusSphere(c, size.length() / 2, { direction: dir, distance: fit + size.z / 2, duration: 0.6 });
      this.invalidate();
    }, 120);
  }

  /** Bounds of the shown (non-context) anatomy at a given arch explode. */
  private explodedBounds(ex: number): THREE.Box3 {
    const box = new THREE.Box3();
    const b = new THREE.Box3();
    const stretch = neurovascularStretch(this.registry).multiplyScalar(ex);
    for (const e of this.entries.values()) {
      if (!isFullyShown(e.visual) || this.isContextMesh(e.key)) continue;
      const geo = e.mesh.geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      b.copy(geo.boundingBox!).translate(e.archOffset.clone().multiplyScalar(ex));
      if (geo.morphAttributes.position) b.expandByPoint(b.max.clone().add(stretch));
      box.union(b);
    }
    return box;
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
    this.refreshRootCuts(ctx.state);
    this.labels?.markSceneChanged();
    this.invalidate();
  }

  /** Keep roots beneath opaque gingiva in the assembled mouth; reveal them as the arches separate. */
  private refreshRootCuts(s: AppState) {
    const ctx = this.visibilityCtx();
    for (const e of this.entries.values()) {
      const fdi = shellFdi(e.key);
      if (fdi === null) continue;
      const gum = fdi < 30 ? 'gingiva-upper' : 'gingiva-lower';
      const gumShown = resolveMesh(gum, ctx) === 'on' && s.dissectFdi === null && !s.clip.enabled && s.explodePhase === 1;
      const tooth = this.registry.manifest.teeth[String(fdi)];
      e.rootCut = gumShown ? { extract: tooth?.extract ?? 2, collar: tooth?.collar ?? 0.2 } : undefined;
      if (!e.rootCut) e.mesh.material.userData.fx.uRootCut.value = -100;
    }
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
      e.mesh.material.userData.fx.uHiColor.value.copy(highlightColor(e.mesh.material, e.hover));
    }
    const s = selectedId ? this.registry.get(selectedId) : undefined;
    this.marker.visible = !!s && s.kind === 'landmark' && !!s.anchor;
    this.invalidate();
  }

  /** Skull and muscles: the surroundings, left out when framing the dental anatomy. */
  private isContextMesh(key: string): boolean {
    const cats = this.registry.categoriesOfMesh(key);
    return cats.includes('skull') || cats.includes('muscles');
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
      if (this.isContextMesh(e.key)) continue;
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
      const style = m.userData.styleKey;
      m.userData.fx.uCapEnabled.value = clip.enabled && ['shell', 'enamel', 'dentin-coronal', 'dentin-radicular', 'cementum', 'pdl', 'pulp-chamber', 'canal'].includes(style) ? 1 : 0;
      if ((m.clippingPlanes?.length ?? 0) !== (planes?.length ?? 0)) {
        m.clippingPlanes = planes;
        m.needsUpdate = true;
      }
    }
    this.labels?.markSceneChanged();
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
        if (st && this.entries.get(k)?.visual === 'on') addMeshLabel(k, shortOf(st, s.lang), 'structure', st.labelPriority + 3, [k]);
      }
      for (const d of this.registry.descendants(tooth.id)) {
        if (d.kind !== 'landmark' || !d.anchor || d.id.startsWith('pulp-horn-') && !d.id.startsWith('pulp-horn-1-')) continue;
        const parentKey = d.parent && this.registry.get(d.parent)?.meshes[0];
        const parentEntry = parentKey ? this.entries.get(parentKey) : undefined;
        if (parentEntry && parentEntry.visual === 'off') continue;
        const anchor = new THREE.Vector3(...d.anchor);
        out.push({
          id: d.id,
          text: shortOf(d, s.lang),
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
        if (st.toothFdi !== undefined || st.labelPriority < 3 || st.regional) continue;
        if (st.kind === 'mesh') {
          const vis = st.meshes.filter((k) => isFullyShown(this.entries.get(k)?.visual ?? 'off'));
          if (vis.length) addMeshLabel(st.id, shortOf(st, s.lang), 'structure', st.labelPriority, vis);
        } else if (st.kind === 'landmark' && st.anchor) {
          const ok = st.categories.every((c) => s.categories[c] !== 'off');
          if (!ok) continue;
          const a = new THREE.Vector3(...st.anchor);
          const jaw = this.entries.get('mandible-body');
          out.push({ id: st.id, text: nameOf(st, s.lang), kind: 'landmark', priority: st.labelPriority, radius: 0.35, owners: new Set([st.id]), anchor: () => (jaw ? a.clone().add(jaw.mesh.position) : a) });
        }
      }
    }
    this.labels.setCandidates(out);
    this.invalidate();
  }

  private labelAnchor(e: MeshEntry): THREE.Vector3 {
    if (!e.labelPoint) e.labelPoint = computeLabelPoint(e.mesh.geometry, e.key, e.owner, this.registry);
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

  private pickables(opaqueOnly = false): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const e of this.entries.values()) if (e.mesh.visible && (opaqueOnly ? isSolid(e) : e.visual !== 'off')) out.push(e.mesh);
    return out;
  }

  /**
   * Entries hit by the current raycaster ray, nearest first, skipping parts cut away by the section.
   * `opaqueOnly` leaves ghosted and see-through meshes out of the test (they never occlude).
   */
  private *rayHits(opaqueOnly = false): Generator<{ entry: MeshEntry; distance: number }> {
    const clip = getState().clip.enabled;
    for (const h of this.raycaster.intersectObjects(this.pickables(opaqueOnly), false)) {
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
      if (isSolid(entry)) return entry.owner;
      ghost ??= entry.owner;
    }
    return ghost;
  }

  private raycastOwner(from: THREE.Vector3, to: THREE.Vector3): { id: string; distance: number } | null {
    this.raycaster.set(from, to.clone().sub(from).normalize());
    // only hits in front of the label anchor can hide it: stop the ray there
    this.raycaster.far = from.distanceTo(to);
    try {
      for (const { entry, distance } of this.rayHits(true)) return { id: entry.owner, distance };
      return null;
    } finally {
      this.raycaster.far = Infinity;
    }
  }

  private updateHover() {
    if (!this.pointerDirty || !this.pointerInside || this.down) return;
    this.pointerDirty = false;
    const id = this.pick();
    actions.hover(id);
    if (id) {
      const s = this.registry.get(id)!;
      const { numbering: n, lang } = getState();
      const fdi = s.toothFdi;
      const name = nameOf(s, lang);
      this.tip.textContent = fdi ? `${name} · ${formatTooth(fdi, n)}` : name;
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
    if (isToothPart) {
      const st = getState();
      const inTooth = st.dissectFdi === fdi;
      // a tooth part is shown inside the tooth, at a dissection level that reveals it
      // (unless an overview section already shows this tooth's layers)
      if (!inTooth && !(st.clip.enabled && this.loadedTeeth.has(fdi))) {
        actions.enterDissect(fdi);
        actions.setDissectLevel(levelShowing(id));
      } else if (inTooth && !levelShows(st.dissectLevel, id)) actions.setDissectLevel(levelShowing(id));
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
    // inside a tooth, or with a structure isolated, frame just that
    const framed = dissectFdi !== null ? this.boundsOf(`tooth-${dissectFdi}`, false) : selectedId && getState().isolateId ? this.boundsOf(selectedId, true) : null;
    if (framed) {
      const sph = framed.getBoundingSphere(new THREE.Sphere());
      this.rig.preset(p, sph.center, sph.radius * 1.2);
    } else if (getState().explode > 0 && getState().explodePhase === 1) {
      // the separated jaws need a wider frame than the assembled mouth
      this.reframeForExplode(getState(), p);
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

  /** Fresh start: orbit centred on the dentition again and a straight-on front view of the whole mouth. */
  resetToStart() {
    this.updatePivot();
    this.startView();
  }

  /**
   * Start framing: the skull from the front, centred left-right, large enough that the
   * face and jaws fill the view (the top of the cranium may run off the top edge) with
   * the chin resting just above the bottom toolbar.
   */
  private startView(duration = 0.9) {
    if (getState().view !== 'front') setState({ view: 'front' });
    const box = this.skullBounds;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const cam = this.rig.camera;
    const tanV = tanHalfFov(cam);
    const h = this.container?.clientHeight || 1;
    const ins = this.insetTarget;
    // the skull is drawn about as tall as the whole canvas; on narrow (portrait) screens its width decides
    const SKULL_TO_CANVAS = 1.2;
    const fitH = size.y / 2 / tanV / SKULL_TO_CANVAS;
    const fitW = (size.x / 2 / (tanV * cam.aspect)) * 1.06;
    const fit = Math.max(fitH, fitW); // camera distance from the front of the skull
    if (this.rig.mode === 'fixed') {
      // the fixed orbit keeps its target on the pivot
      this.rig.focusSphere(this.rig.pivot, size.y / 2, { direction: new THREE.Vector3(0, 0.02, 1), distance: fit + (box.max.z - this.rig.pivot.z), duration });
      this.invalidate();
      return;
    }
    // world units per screen pixel at the front of the skull; the view offset puts the target
    // in the middle of the area above the toolbar, so lift it until the chin sits a margin above it
    const perPx = (2 * fit * tanV) / h;
    // on phones the bottom bar floats over the canvas without an inset; keep the chin clear of it
    const reserve = Math.max(ins.bottom, (this.container?.clientWidth ?? 1000) < 768 ? 120 : 0);
    const aboveBar = h - reserve - h * 0.01 - (h - ins.bottom) / 2;
    const target = new THREE.Vector3(center.x, box.min.y + aboveBar * perPx, center.z);
    this.rig.focusSphere(target, size.y / 2, { direction: new THREE.Vector3(0, 0.02, 1), distance: fit + (box.max.z - center.z), duration });
    this.invalidate();
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
    const t = this.insetTarget;
    if (t.right === right && t.bottom === bottom) return;
    this.insetTarget = { right, bottom };
    // still on the untouched start view (e.g. the panels just measured on load): refit it
    const s = getState();
    const first = !this.insetsKnown;
    this.insetsKnown = true;
    if (s.view === 'front' && !s.selectedId && s.dissectFdi === null) {
      if (s.explode > 0 && s.explodePhase === 1) this.reframeForExplode(s);
      else if (s.explodePhase === 1) this.startView(first ? 0 : 0.35);
    }
    this.animator.run('insets', first ? 0 : 0.35, (k) => {
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

    const pulpMode = s.dissectFdi !== null && s.dissectLevel === DISSECT_LEVELS.length - 1 ? 1 : 0;
    if (Math.abs(this.pulpModeCur - pulpMode) > 1e-4) {
      this.pulpModeCur = stepToward(this.pulpModeCur, pulpMode, rate, 1e-3);
      moving = true;
    }

    // label occlusion only needs recomputing when meshes move or appear/disappear
    let layoutChanged = false;
    const prevPos = new THREE.Vector3();
    for (const e of this.entries.values()) {
      let target = visualOpacity(e.visual, s.ghostOpacity);
      if (e.nv) {
        const dissecting = s.explodePhase === 1 && s.dissectFdi === null ? Math.min(1, this.explodeCur * 2.5) : 0;
        const quietTarget = quietLevel(e, dissecting);
        if (Math.abs(e.quiet! - quietTarget) > 1e-3) {
          e.quiet = stepToward(e.quiet!, quietTarget, rate, 0.01);
          const mat = e.mesh.material;
          mat.color.copy(themedColor(mat.userData.styleKey, s.theme)).lerp(QUIET_TINT[s.theme], QUIET_MIX * e.quiet);
          moving = true;
        }
        target *= quietOpacity(e, e.quiet!);
      }
      if (e.sinus) target *= SINUS_OPACITY;
      if (s.explodePhase === 2 && !e.boardTarget) target = 0; // context is not laid out: fade it away
      if (Math.abs(e.opacity - target) > 1e-3) {
        e.opacity = stepToward(e.opacity, target, rate, 0.01);
        moving = true;
      }
      const vis = e.opacity > 0.005;
      if (e.mesh.visible !== vis) {
        e.mesh.visible = vis;
        layoutChanged = true;
      }
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
      prevPos.copy(e.mesh.position);
      e.mesh.position.copy(e.archOffset).multiplyScalar(this.explodeCur);
      if (e.rootCut) {
        // Roots below the gum line are never drawn while the gum is shown: assembled, the thin
        // see-through bone would otherwise show them sticking out under the gum; while a tooth
        // slides out, the part still inside the gum is cut away so a flared root never shows
        // through the narrower gum collar.
        e.mesh.material.userData.fx.uRootCut.value =
          this.explodeCur < 1e-3 ? ROOT_CUT_REST : e.rootCut.collar - this.explodeCur * e.rootCut.extract;
      }
      if (e.mesh.morphTargetInfluences) {
        const stretch = this.explodeCur * (1 - this.phaseCur);
        if (e.mesh.morphTargetInfluences[0] !== stretch) e.mesh.morphTargetInfluences[0] = stretch;
      }
      if (toothPart) e.mesh.position.addScaledVector(this.tmpOffset.lerpVectors(e.toothOffset, e.pulpOffset, this.pulpModeCur), this.toothExplodeCur);
      if (e.boardPos && this.phaseCur > 0) {
        if (e.boardTarget && e.boardPos.distanceToSquared(e.boardTarget) > 1e-8) {
          e.boardPos.lerp(e.boardTarget, boardK);
          moving = true;
        }
        e.mesh.position.lerp(e.boardPos, this.phaseCur);
      }
      if (!layoutChanged && !prevPos.equals(e.mesh.position)) layoutChanged = true;
    }
    if (layoutChanged) this.labels?.markSceneChanged();

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

/** Accelerated ray test while the morph is at rest, the plain (morph-following) one while stretched. */
function morphAwareRaycast(this: THREE.Mesh, raycaster: THREE.Raycaster, hits: THREE.Intersection[]) {
  if (this.morphTargetInfluences?.some((v) => v !== 0)) THREE.Mesh.prototype.raycast.call(this, raycaster, hits);
  else acceleratedRaycast.call(this, raycaster, hits);
}

/** Mesh visuals that are shown in full (laid out on the board, framed, labelled): opaque or see-through bone. */
function isFullyShown(v: MeshVisual): boolean {
  return v === 'on' || v === 'see-through';
}

/** Resting opacity for a mesh visual (before the nerve and vessel fade and the board fade-out). */
function visualOpacity(v: MeshVisual, ghostOpacity: number): number {
  return v === 'on' ? 1 : v === 'see-through' ? SEE_THROUGH_OPACITY : v === 'ghost' ? ghostOpacity : v === 'faint' ? ghostOpacity * 0.45 : 0;
}

/** FDI number of a tooth shell mesh key ("tooth-36" → 36), or null for any other mesh. */
function shellFdi(key: string): number | null {
  const m = /^tooth-(\d{2})$/.exec(key);
  return m ? Number(m[1]) : null;
}

/** tan(vertical fov / 2): converts a half-height in view to the camera distance that fits it. */
function tanHalfFov(cam: THREE.PerspectiveCamera): number {
  return Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
}

/** Along the tooth axis from the cervical line (cm): where the gum collar hides the root in the assembled mouth. */
const ROOT_CUT_REST = -0.12;

const QUIET_MIX = 0.6;
const QUIET_TINT = { light: new THREE.Color('#d8d2c6'), dark: new THREE.Color('#3a3833') };

/** The maxillary sinus is air: at most this opaque, so the roots and nerves around it stay visible. */
const SINUS_OPACITY = 0.55;

/** Bone opacity while the nerve and vessel layers are on. */
const SEE_THROUGH_OPACITY = 0.32;

/** One easing step from `cur` toward `target`, snapping to the target once within `snap`. */
function stepToward(cur: number, target: number, rate: number, snap: number): number {
  const next = cur + (target - cur) * rate;
  return Math.abs(next - target) < snap ? target : next;
}

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(() => r(null)));
}
