/**
 * Anchored DOM labels with priority-based decluttering and occlusion culling.
 * Positions are written directly to the DOM each rendered frame — no React.
 */
import * as THREE from 'three';

export interface LabelCandidate {
  id: string;
  text: string;
  /** world-space anchor provider (called per frame, respects explode offsets) */
  anchor: () => THREE.Vector3;
  /** approximate world radius of the structure, drives zoom-based visibility */
  radius: number;
  priority: number;
  /** structure ids that count as "this label's structure" for occlusion tests */
  owners: Set<string>;
  kind: 'tooth' | 'structure' | 'landmark';
}

interface LabelEl {
  el: HTMLButtonElement;
  visible: boolean;
}

const PAD = 4;

export class LabelLayer {
  private root: HTMLElement;
  private els = new Map<string, LabelEl>();
  private candidates: LabelCandidate[] = [];
  private occluded = new Set<string>();
  private lastOcclusion = 0;
  private blocked: { x0: number; y0: number; x1: number; y1: number }[] = [];
  /** CSS selector for UI elements labels must not sit under */
  blockSelector = '.ds-panel, .ds-identity, .ds-top-actions';
  enabled = false;
  selectedId: string | null = null;
  onClick?: (id: string) => void;
  /** returns the structure id at the first ray hit from the camera toward a point, or null */
  raycastOwner?: (from: THREE.Vector3, to: THREE.Vector3) => { id: string; distance: number } | null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  setCandidates(c: LabelCandidate[]) {
    this.candidates = c;
    const ids = new Set(c.map((x) => x.id));
    for (const [id, l] of this.els) {
      if (!ids.has(id)) {
        l.el.remove();
        this.els.delete(id);
      }
    }
    for (const cand of c) {
      let l = this.els.get(cand.id);
      if (!l) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `ds-label ds-label--${cand.kind}`;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.onClick?.(cand.id);
        });
        el.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.root.appendChild(el);
        l = { el, visible: false };
        this.els.set(cand.id, l);
      }
      if (l.el.textContent !== cand.text) {
        l.el.textContent = cand.text;
        l.el.setAttribute('aria-label', `Select ${cand.text}`);
      }
    }
  }

  update(camera: THREE.PerspectiveCamera, width: number, height: number, now: number, force = false) {
    if (!this.enabled) {
      for (const l of this.els.values()) if (l.visible) this.show(l, false);
      return;
    }
    if (force || now - this.lastOcclusion > 180) {
      this.lastOcclusion = now;
      this.computeOcclusion(camera);
      this.computeBlocked();
    }
    const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const tmp = new THREE.Vector3();
    const camDir = camera.getWorldDirection(new THREE.Vector3());
    const pxPerUnitAt = (d: number) => height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * d);
    const sorted = [...this.candidates].sort((a, b) => (b.id === this.selectedId ? 1 : 0) - (a.id === this.selectedId ? 1 : 0) || b.priority - a.priority);
    for (const c of sorted) {
      const l = this.els.get(c.id)!;
      const p = c.anchor();
      tmp.copy(p).sub(camera.position);
      const depth = tmp.dot(camDir);
      if (depth <= camera.near) {
        this.show(l, false);
        continue;
      }
      const screenR = c.radius * pxPerUnitAt(depth);
      const minR = c.kind === 'tooth' ? 7 : 26 - c.priority * 4;
      const selected = c.id === this.selectedId;
      if ((!selected && screenR < minR) || this.occluded.has(c.id)) {
        this.show(l, false);
        continue;
      }
      tmp.copy(p).project(camera);
      if (tmp.x < -1 || tmp.x > 1 || tmp.y < -1 || tmp.y > 1) {
        this.show(l, false);
        continue;
      }
      const x = (tmp.x * 0.5 + 0.5) * width;
      const y = (-tmp.y * 0.5 + 0.5) * height;
      const w = l.el.offsetWidth || 60;
      const h = l.el.offsetHeight || 20;
      const rect = { x0: x - w / 2 - PAD, y0: y - h - 8 - PAD, x1: x + w / 2 + PAD, y1: y - 8 + PAD };
      const overlaps = (r: { x0: number; y0: number; x1: number; y1: number }) => r.x0 < rect.x1 && r.x1 > rect.x0 && r.y0 < rect.y1 && r.y1 > rect.y0;
      if (this.blocked.some(overlaps) || (!selected && placed.some(overlaps))) {
        this.show(l, false);
        continue;
      }
      placed.push(rect);
      l.el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, calc(-100% - 8px))`;
      l.el.classList.toggle('is-selected', selected);
      this.show(l, true);
    }
  }

  private show(l: LabelEl, v: boolean) {
    if (l.visible === v) return;
    l.visible = v;
    l.el.classList.toggle('is-visible', v);
    l.el.tabIndex = v ? 0 : -1;
  }

  private computeOcclusion(camera: THREE.PerspectiveCamera) {
    this.occluded.clear();
    if (!this.raycastOwner) return;
    for (const c of this.candidates) {
      const p = c.anchor();
      const hit = this.raycastOwner(camera.position, p);
      if (!hit) continue;
      const dist = camera.position.distanceTo(p);
      // landmarks sit on or just inside surfaces: allow a small tolerance
      const tol = c.kind === 'landmark' ? 0.35 : Math.min(c.radius * 0.9, 0.3);
      if (hit.distance < dist - tol && !c.owners.has(hit.id)) this.occluded.add(c.id);
    }
  }

  private computeBlocked() {
    const host = this.root.getBoundingClientRect();
    const els = document.querySelectorAll<HTMLElement>(this.blockSelector);
    this.blocked = [];
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      this.blocked.push({ x0: r.left - host.left, y0: r.top - host.top, x1: r.right - host.left, y1: r.bottom - host.top });
    });
  }

  dispose() {
    for (const l of this.els.values()) l.el.remove();
    this.els.clear();
  }
}
