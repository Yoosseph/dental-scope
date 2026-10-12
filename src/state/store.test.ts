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

describe('quiz mode transitions', () => {
  beforeEach(() => actions.resetAll());

  it('lays the board out for quiz and restores the explore scene on exit', () => {
    setState({ selectedId: 'tooth-11', view: 'left', labels: true, numbering: 'palmer' });
    actions.enterQuiz();
    expect(getState()).toMatchObject({
      mode: 'quiz', explode: 1, explodePhase: 2, labels: false,
      mobileSheet: 'none', searchOpen: false, guideOpen: false, aboutOpen: false, creditsOpen: false, controlsOpen: false,
    });
    actions.exitQuiz();
    expect(getState()).toMatchObject({
      mode: 'explore', view: 'left', labels: true, selectedId: 'tooth-11', numbering: 'palmer',
    });
  });

  it('keeps the quiz scene for the second visit instead of restoring a stale snapshot', () => {
    actions.enterQuiz();
    actions.exitQuiz();
    setState({ view: 'inferior', labels: false });
    actions.enterQuiz();
    actions.exitQuiz();
    expect(getState().mode).toBe('explore');
    // the first explore scene (front view etc.) must not resurface
    expect(getState().view).toBe('inferior');
    expect(getState().labels).toBe(false);
  });

  it('is a no-op when already in Quiz mode', () => {
    actions.enterQuiz();
    setState({ labels: true });
    actions.enterQuiz();
    expect(getState().mode).toBe('quiz');
    expect(getState().labels).toBe(true); // untouched by the no-op
  });

  it('leaves the quiz before opening search or the guide', () => {
    actions.enterQuiz();
    actions.openSearch(true);
    expect(getState()).toMatchObject({ mode: 'explore', searchOpen: true });

    actions.enterQuiz();
    actions.startGuide();
    expect(getState()).toMatchObject({ mode: 'explore', guideOpen: true });
  });

  it('closing search after a forced exit does not resurrect Quiz mode', () => {
    actions.enterQuiz();
    actions.openSearch(true);
    actions.openSearch(false);
    expect(getState().mode).toBe('explore');
  });

  it('leaves dissection and development stages before taking its snapshot', () => {
    actions.enterDissect(36);
    actions.setDevelopmentStage('primary');
    actions.enterQuiz();
    expect(getState().mode).toBe('quiz');
    actions.exitQuiz();
    expect(getState()).toMatchObject({ mode: 'explore', dissectFdi: null, developmentStage: null });
  });

  it('keeps the mobile sheet closed while picking answers in the quiz', () => {
    actions.enterQuiz();
    actions.select('tooth-16');
    expect(getState().mobileSheet).toBe('none');
    actions.exitQuiz();
    // back in explore a selection opens the detail sheet as usual
    actions.select('tooth-16');
    expect(getState().mobileSheet).toBe('detail');
  });

  it('resetAll clears the quiz mode and any saved session', () => {
    actions.enterQuiz();
    actions.select('tooth-16');
    actions.resetAll();
    expect(getState()).toMatchObject({ mode: 'explore', selectedId: null, mobileSheet: 'none', explode: 0 });
  });
});
