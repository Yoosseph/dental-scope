/** Script data and playback are independent of React and the anatomy engine. */
export interface TourStep {
  id: string;
  target?: string;
  action?: 'click' | 'search' | 'finish';
  value?: string;
  panel?: 'tools' | 'detail' | 'layers';
  hold: number;
  /** Existing, sourced educational content accompanies these steps. */
  development?: 'primary' | 'early-mixed';
  waitFor?: { selectedId?: string; dissectFdi?: number; asset?: string };
}

export const FIRST_VISIT_TOOTH = 36;
export const FIRST_VISIT_TOUR: readonly TourStep[] = [
  { id: 'welcome', hold: 1800 },
  { id: 'primary', target: 'development-primary', action: 'click', panel: 'tools', development: 'primary', hold: 3200 },
  { id: 'mixed', target: 'development-early-mixed', action: 'click', panel: 'tools', development: 'early-mixed', hold: 3200 },
  { id: 'adult', target: 'development-adult', action: 'click', panel: 'tools', hold: 1000 },
  { id: 'teeth', target: 'preset-dentition', action: 'click', panel: 'layers', hold: 1000 },
  { id: 'search', target: 'search', action: 'click', hold: 1200 },
  { id: 'query', target: 'search-input', action: 'search', value: `fdi ${FIRST_VISIT_TOOTH}`, hold: 1100 },
  { id: 'tooth', target: `result-tooth-${FIRST_VISIT_TOOTH}`, action: 'click', waitFor: { selectedId: `tooth-${FIRST_VISIT_TOOTH}` }, hold: 2000 },
  { id: 'details', target: 'tooth-details', panel: 'detail', hold: 2800 },
  { id: 'inside', target: 'explore-inside', action: 'click', waitFor: { dissectFdi: FIRST_VISIT_TOOTH }, panel: 'detail', hold: 1600 },
  { id: 'dentin', target: 'dissect-2', action: 'click', panel: 'tools', hold: 2000 },
  { id: 'canals', target: 'dissect-4', action: 'click', panel: 'tools', hold: 2400 },
  { id: 'assembled', target: 'dissect-0', action: 'click', panel: 'tools', hold: 1000 },
  { id: 'layers', target: 'separate-layers', action: 'click', panel: 'tools', hold: 2400 },
  { id: 'mouth', target: 'back-mouth', action: 'click', panel: 'tools', hold: 1000 },
  { id: 'nerves', target: 'preset-nerves', action: 'click', waitFor: { asset: 'neurovascular' }, panel: 'layers', hold: 2800 },
  { id: 'ready', action: 'finish', hold: 0 },
];

export interface TourPlayback {
  paused: () => boolean;
  showStep: (step: TourStep, index: number) => void;
  prepare: (step: TourStep) => void;
  locate: (target: string) => boolean;
  point: (target: string, clicking: boolean) => void;
  activate: (step: TourStep) => void;
  settled: (step: TourStep) => boolean;
  clearPointer: () => void;
}

/** Abortable timers, including paused time, prevent a closed tour from clicking later. */
export function tourDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason)));
    const abort = () => { clearTimeout(timer); reject(signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason))); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function playTour(steps: readonly TourStep[], port: TourPlayback, signal: AbortSignal, reducedMotion = false) {
  const wait = async (ms: number) => {
    let remaining = ms;
    // Always pass through the gate, even for a zero-duration action.
    do {
      while (port.paused()) await tourDelay(80, signal);
      const slice = Math.min(80, remaining);
      await tourDelay(slice, signal);
      if (!port.paused()) remaining -= slice;
    } while (remaining > 0 || port.paused());
    signal.throwIfAborted();
  };
  const until = async (check: () => boolean) => {
    let elapsed = 0;
    while (!check()) {
      if (elapsed >= 15000) throw new Error('Tour target unavailable');
      await wait(80);
      elapsed += 80;
    }
    await wait(0);
  };
  for (const [index, step] of steps.entries()) {
    await wait(0);
    port.clearPointer();
    port.showStep(step, index);
    port.prepare(step);
    if (step.target) {
      await until(() => port.locate(step.target!));
      port.point(step.target, false);
      await wait(reducedMotion ? 100 : 450);
      if (step.action) {
        // Re-measure after layout/viewport changes; never click a stale target.
        await until(() => port.locate(step.target!));
        port.point(step.target, true);
        await wait(reducedMotion ? 100 : 150);
      }
    }
    if (step.action) port.activate(step);
    await until(() => port.settled(step));
    // The circle's CSS animation lasts 1.5s; the narration holds independently.
    await wait(step.hold);
  }
  port.clearPointer();
}

export const GUIDE_VISIT_KEY = 'ds.guide.seen.v1';
type VisitStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function needsFirstVisitGuide(storage: VisitStorage): boolean {
  try { return storage.getItem(GUIDE_VISIT_KEY) !== 'seen'; } catch { return true; }
}
export function rememberGuideVisit(storage: VisitStorage) {
  try { storage.setItem(GUIDE_VISIT_KEY, 'seen'); } catch { /* Session still works without storage. */ }
}
