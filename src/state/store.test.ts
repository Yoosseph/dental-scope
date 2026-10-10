import { beforeEach, describe, expect, it } from 'vitest';
import { actions, getState, initialState, setState } from './store';

describe('orbit mode inside a tooth', () => {
  beforeEach(() => setState({ ...initialState }));

  it('switches to the free orbit inside a tooth and back to fixed when leaving', () => {
    expect(getState().orbitMode).toBe('fixed');
    actions.enterDissect(36);
    expect(getState().orbitMode).toBe('free');
    actions.enterDissect(37); // moving to another tooth stays free
    expect(getState().orbitMode).toBe('free');
    actions.exitDissect();
    expect(getState().orbitMode).toBe('fixed');
  });

  it('keeps a mode the user picks inside the tooth', () => {
    actions.enterDissect(36);
    actions.setOrbitMode('fixed');
    actions.exitDissect();
    expect(getState().orbitMode).toBe('fixed');
    actions.enterDissect(36);
    actions.setOrbitMode('free');
    actions.exitDissect();
    expect(getState().orbitMode).toBe('free');
  });
});

describe('scene transitions', () => {
  beforeEach(() => actions.resetAll());

  it('restores the adult study scene after development without reviving playback', () => {
    actions.applyStudyPreset('vessels');
    actions.setVesselSide('left');
    const categories = getState().categories;
    actions.setDevelopmentStage('primary');
    expect(getState()).toMatchObject({ studyView: null, jawPlaying: false, selectedId: null });
    actions.setDevelopmentStage('early-mixed');
    actions.setDevelopmentStage(null);
    expect(getState()).toMatchObject({ studyView: 'vessels', vesselSide: 'left', categories, developmentPlaying: false });
  });

  it('clears pending selection and incompatible tools on a study transition', () => {
    setState({ selectionRequest: { id: 'tooth-11', kind: 'select', status: 'loading' }, jawPlaying: true, explode: 1, hidden: { maxilla: true }, clip: { enabled: true, axis: 'sagittal', offset: 0, flip: false } });
    actions.applyStudyPreset('dentition');
    expect(getState()).toMatchObject({ selectionRequest: null, jawPlaying: false, explode: 0, hidden: {}, clip: { enabled: false } });
  });
});
