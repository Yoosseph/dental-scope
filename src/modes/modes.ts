/**
 * Educational modes (docs/architecture.md §10).
 * Explore is implemented; Learn, Quiz and Compare are scaffolded so they can be
 * built without touching the engine or the explorer UI.
 */
import type { Registry } from '../anatomy/registry';
import type { Engine } from '../engine/Engine';
import { registerVisibilityFilter, type VisibilityFilter } from '../state/visibility';
import type { ModeId } from '../state/store';

export interface ModeContext {
  registry: Registry;
  engine: Engine;
}

export interface Mode {
  id: ModeId;
  label: string;
  available: boolean;
  description: string;
  enter?(ctx: ModeContext): void;
  exit?(ctx: ModeContext): void;
  visibilityFilter?: VisibilityFilter;
}

/** Lesson data format for Learn mode. */
export interface LessonStep {
  title: string;
  body: string;
  target?: string; // structure id to select & focus
  view?: string; // camera preset
  categories?: Record<string, 'on' | 'ghost' | 'off'>;
  dissect?: { fdi: number; level: number };
}
export interface Lesson {
  id: string;
  title: string;
  steps: LessonStep[];
}

/** Quiz: pick a structure from a pool; the user must name it. */
export function pickQuizTarget(registry: Registry, pool: (id: string) => boolean, rnd = Math.random): string | null {
  const ids = [...registry.byId.values()].filter((s) => (s.kind === 'mesh' || s.tooth) && pool(s.id)).map((s) => s.id);
  return ids.length ? ids[Math.floor(rnd() * ids.length)] : null;
}

export const MODES: Mode[] = [
  { id: 'explore', label: 'Explore', available: true, description: 'Free exploration of the whole dental anatomy.' },
  { id: 'learn', label: 'Learn', available: false, description: 'Guided lessons that step through anatomy (coming soon).' },
  { id: 'quiz', label: 'Quiz', available: false, description: 'Identify highlighted structures (coming soon).' },
  { id: 'compare', label: 'Compare', available: false, description: 'Two teeth side by side (coming soon).' },
];

let activeFilterDispose: (() => void) | null = null;

export function switchMode(from: Mode | undefined, to: Mode, ctx: ModeContext) {
  from?.exit?.(ctx);
  activeFilterDispose?.();
  activeFilterDispose = to.visibilityFilter ? registerVisibilityFilter(to.visibilityFilter) : null;
  to.enter?.(ctx);
}
