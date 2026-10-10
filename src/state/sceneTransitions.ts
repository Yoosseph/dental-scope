import type { AppState } from './store';

/** Scene settings temporarily saved while the developmental scene is active. */
export function adultSceneSnapshot(s: AppState) {
  return {
    categories: s.categories, hidden: s.hidden, ghosted: s.ghosted,
    isolateId: s.isolateId, isolateContext: s.isolateContext,
    explode: s.explode, explodePhase: s.explodePhase, clip: s.clip,
    jawControls: s.jawControls, jawOpening: s.jawOpening, labels: s.labels,
    studyView: s.studyView, vesselSide: s.vesselSide, vesselMode: s.vesselMode,
  };
}

/** Shared reset when entering an adult study preset or a developmental stage. */
export function clearSceneTools(s: AppState): Partial<AppState> {
  return {
    selectedId: null, hoveredId: null, hidden: {}, ghosted: {},
    isolateId: null, isolateContext: false, passageIds: [],
    jawControls: false, jawOpening: 0, jawPlaying: false,
    explode: 0, explodePhase: 1, toothExplode: 0,
    clip: { ...s.clip, enabled: false }, selectionRequest: null,
  };
}
