/**
 * Application state (Zustand vanilla store).
 * The engine subscribes with `store.subscribe`; React uses `useApp(selector)`.
 * Keep this plain data — no Three.js objects in here.
 */
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { INITIAL_CATEGORY_STATE, type CategoryState } from '../anatomy/categories';
import type { CategoryId, NumberingSystem } from '../anatomy/types';

export type ClipAxis = 'sagittal' | 'coronal' | 'axial' | 'view';
export type ModeId = 'explore' | 'learn' | 'quiz' | 'compare';
/** Camera navigation: fixed turntable around the model centre, or free pivot that follows pan/focus. */
export type OrbitMode = 'fixed' | 'free';
/** Arch dissection phase: 1 = pulled apart in position, 2 = every structure laid out on a board. */
export type ExplodePhase = 1 | 2;
export type ViewPreset =
  | 'three-quarter'
  | 'front'
  | 'left'
  | 'right'
  | 'superior'
  | 'inferior'
  | 'occlusal-upper'
  | 'occlusal-lower';

export interface ClipState {
  enabled: boolean;
  axis: ClipAxis;
  /** -1…1 across the active bounds */
  offset: number;
  flip: boolean;
}

/** Dissection levels for a single tooth. */
export const DISSECT_LEVELS = [
  { id: 0, label: 'Whole tooth', hint: 'Outer surface: enamel crown and cementum-covered root' },
  { id: 1, label: 'Crown & root', hint: 'Crown and root regions with the periodontal ligament' },
  { id: 2, label: 'Enamel removed', hint: 'Enamel lifted away to reveal the dentin' },
  { id: 3, label: 'Pulp revealed', hint: 'Dentin made translucent to reveal the pulp chamber' },
  { id: 4, label: 'Root canals', hint: 'Pulp chamber and root canals in isolation' },
] as const;

export interface AppState {
  ready: boolean;
  loading: Record<string, number>; // stage → 0…1
  error?: string;

  selectedId: string | null;
  hoveredId: string | null;

  categories: Record<CategoryId, CategoryState>;
  hidden: Record<string, true>;
  ghosted: Record<string, true>;
  isolateId: string | null;
  /** when isolating, show the rest as translucent context */
  isolateContext: boolean;
  ghostOpacity: number;

  explode: number; // 0…1 arch level
  explodePhase: ExplodePhase;
  labels: boolean;
  clip: ClipState;
  numbering: NumberingSystem;
  view: ViewPreset | null;
  autoRotate: boolean;
  orbitMode: OrbitMode;

  dissectFdi: number | null;
  dissectLevel: number;
  toothExplode: number; // 0…1

  mode: ModeId;
  searchOpen: boolean;
  aboutOpen: boolean;
  panel: 'layers' | 'tree';
  mobileSheet: 'none' | 'layers' | 'detail' | 'tools';
  theme: 'light' | 'dark';
}

const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export const initialState: AppState = {
  ready: false,
  loading: {},
  selectedId: null,
  hoveredId: null,
  categories: { ...INITIAL_CATEGORY_STATE },
  hidden: {},
  ghosted: {},
  isolateId: null,
  isolateContext: false,
  ghostOpacity: 0.18,
  explode: 0,
  explodePhase: 1,
  labels: false,
  clip: { enabled: false, axis: 'sagittal', offset: 0, flip: false },
  numbering: 'fdi',
  view: 'three-quarter',
  autoRotate: false,
  orbitMode: 'free',
  dissectFdi: null,
  dissectLevel: 0,
  toothExplode: 0,
  mode: 'explore',
  searchOpen: false,
  aboutOpen: false,
  panel: 'layers',
  mobileSheet: 'none',
  theme: prefersDark ? 'dark' : 'light',
};

export const store = createStore<AppState>()(() => ({ ...initialState }));

export function useApp<T>(selector: (s: AppState) => T): T {
  return useStore(store, selector);
}

export const getState = store.getState;
export const setState = store.setState;

/* ------------------------------------------------------------------ actions */

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** localStorage keys of the per-viewer preferences. */
const PREF = { numbering: 'ds.numbering', theme: 'ds.theme', orbit: 'ds.orbit' } as const;

/** Remember a per-viewer preference (restored by restorePreferences). */
function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export const actions = {
  select(id: string | null) {
    setState({ selectedId: id, mobileSheet: id ? 'detail' : 'none' });
  },
  hover(id: string | null) {
    if (getState().hoveredId !== id) setState({ hoveredId: id });
  },
  setCategory(id: CategoryId, state: CategoryState) {
    setState((s) => ({ categories: { ...s.categories, [id]: state } }));
  },
  setCategories(next: Partial<Record<CategoryId, CategoryState>>) {
    setState((s) => ({ categories: { ...s.categories, ...next } }));
  },
  showOnlyCategory(id: CategoryId) {
    setState((s) => {
      const next = { ...s.categories };
      for (const k of Object.keys(next) as CategoryId[]) next[k] = 'off';
      next[id] = 'on';
      // tooth tissues require the teeth layer
      if (['enamel', 'dentin', 'cementum', 'dental-pulp', 'root-canals', 'periodontal-ligament'].includes(id)) {
        next['permanent-teeth'] = 'on';
        if (id === 'root-canals') next['dental-pulp'] = 'on';
      }
      return { categories: next };
    });
  },
  hide(id: string) {
    setState((s) => {
      const hidden = { ...s.hidden, [id]: true as const };
      return { hidden, selectedId: s.selectedId === id ? null : s.selectedId };
    });
  },
  unhide(id: string) {
    setState((s) => {
      const hidden = { ...s.hidden };
      delete hidden[id];
      return { hidden };
    });
  },
  toggleGhost(id: string) {
    setState((s) => {
      const ghosted = { ...s.ghosted };
      if (ghosted[id]) delete ghosted[id];
      else ghosted[id] = true;
      return { ghosted };
    });
  },
  isolate(id: string | null) {
    setState({ isolateId: id, isolateContext: false });
  },
  setIsolateContext(on: boolean) {
    setState({ isolateContext: on });
  },
  resetVisibility() {
    setState({ hidden: {}, ghosted: {}, isolateId: null, isolateContext: false, categories: { ...INITIAL_CATEGORY_STATE } });
  },
  setExplode(v: number) {
    const explode = clamp01(v);
    // scrubbing the slider back leaves the laid-out phase
    setState((s) => ({ explode, explodePhase: explode < 1 ? 1 : s.explodePhase }));
  },
  setExplodePhase(phase: ExplodePhase) {
    setState((s) => (phase === 2 ? { explodePhase: 2, explode: 1, clip: { ...s.clip, enabled: false } } : { explodePhase: 1 }));
  },
  setToothExplode(v: number) {
    setState({ toothExplode: clamp01(v) });
  },
  toggleLabels() {
    setState((s) => ({ labels: !s.labels }));
  },
  setClip(patch: Partial<ClipState>) {
    // a section plane cuts through the scene in place, so it leaves the laid-out phase
    setState((s) => ({ clip: { ...s.clip, ...patch }, explodePhase: patch.enabled ? 1 : s.explodePhase }));
  },
  setNumbering(n: NumberingSystem) {
    setState({ numbering: n });
    persist(PREF.numbering, n);
  },
  setView(v: ViewPreset | null) {
    setState({ view: v });
  },
  setAutoRotate(on: boolean) {
    setState({ autoRotate: on });
  },
  setOrbitMode(m: OrbitMode) {
    setState({ orbitMode: m });
    persist(PREF.orbit, m);
  },
  enterDissect(fdi: number) {
    setState({ dissectFdi: fdi, dissectLevel: 0, toothExplode: 0, isolateId: `tooth-${fdi}`, isolateContext: true, explode: 0, explodePhase: 1 });
  },
  exitDissect() {
    setState((s) => ({
      dissectFdi: null,
      dissectLevel: 0,
      toothExplode: 0,
      isolateId: s.isolateId?.startsWith('tooth-') ? null : s.isolateId,
      isolateContext: false,
      clip: { ...s.clip, enabled: false },
    }));
  },
  setDissectLevel(level: number) {
    setState({ dissectLevel: Math.max(0, Math.min(DISSECT_LEVELS.length - 1, level)) });
  },
  openSearch(open: boolean) {
    setState({ searchOpen: open });
  },
  openAbout(open: boolean) {
    setState({ aboutOpen: open });
  },
  setPanel(p: AppState['panel']) {
    setState({ panel: p });
  },
  setMobileSheet(m: AppState['mobileSheet']) {
    setState({ mobileSheet: m });
  },
  setTheme(t: AppState['theme']) {
    setState({ theme: t });
    persist(PREF.theme, t);
  },
  setMode(m: ModeId) {
    setState({ mode: m });
  },
  setLoading(stage: string, v: number) {
    setState((s) => ({ loading: { ...s.loading, [stage]: v } }));
  },
};

/** Restore per-viewer preferences. */
export function restorePreferences() {
  try {
    const n = localStorage.getItem(PREF.numbering);
    if (n === 'fdi' || n === 'universal' || n === 'palmer') setState({ numbering: n });
    const t = localStorage.getItem(PREF.theme);
    if (t === 'light' || t === 'dark') setState({ theme: t });
    const o = localStorage.getItem(PREF.orbit);
    if (o === 'fixed' || o === 'free') setState({ orbitMode: o });
  } catch {
    /* storage unavailable */
  }
}
