import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LANGS } from '../i18n/lang';
import { TOUR_TEXT } from '../i18n/tour';
import { actions, getState, initialState, setState } from '../state/store';
import { FIRST_VISIT_TOUR, GUIDE_VISIT_KEY, needsFirstVisitGuide, playTour, rememberGuideVisit, type TourPlayback, type TourStep } from './tour';

const step: TourStep = { id: 'example', target: 'button', action: 'click', hold: 400 };
const port = (): TourPlayback => ({
  paused: () => false, showStep: vi.fn(), prepare: vi.fn(), locate: () => true,
  point: vi.fn(), activate: vi.fn(), settled: () => true, clearPointer: vi.fn(),
});

describe('scripted tour playback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('points, visibly clicks and waits for the real action before advancing', async () => {
    const playback = port();
    let settled = false;
    playback.settled = () => settled;
    const playing = playTour([step, { id: 'ready', action: 'finish', hold: 0 }], playback, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(650);
    expect(playback.point).toHaveBeenNthCalledWith(1, 'button', false);
    expect(playback.point).toHaveBeenNthCalledWith(2, 'button', true);
    expect(playback.activate).toHaveBeenCalledExactlyOnceWith(step);
    await vi.advanceTimersByTimeAsync(1000);
    expect(playback.showStep).toHaveBeenCalledTimes(1);
    settled = true;
    await vi.runAllTimersAsync();
    await playing;
    expect(playback.activate).toHaveBeenCalledTimes(2);
  });

  it('stops immediately while waiting for a target, without any late clicks', async () => {
    const playback = port();
    playback.locate = () => false;
    const abort = new AbortController();
    const playing = playTour([step], playback, abort.signal).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(400);
    abort.abort();
    await playing;
    await vi.runAllTimersAsync();
    expect(playback.activate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses the script before a click and resumes without repeating the action', async () => {
    const playback = port();
    let paused = false;
    playback.paused = () => paused;
    const playing = playTour([step], playback, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(500);
    paused = true;
    await vi.advanceTimersByTimeAsync(4000);
    expect(playback.activate).not.toHaveBeenCalled();
    paused = false;
    await vi.runAllTimersAsync();
    await playing;
    expect(playback.activate).toHaveBeenCalledExactlyOnceWith(step);
  });

  it('reports a missing control so the UI can offer retry or exploration', async () => {
    const playback = port();
    playback.locate = () => false;
    const playing = playTour([step], playback, new AbortController().signal).catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    expect(await playing).toEqual(new Error('Tour target unavailable'));
    expect(playback.activate).not.toHaveBeenCalled();
  });

  it('can run another tour with reduced motion', async () => {
    const playback = port();
    const playing = playTour([{ ...step, id: 'another-guide' }], playback, new AbortController().signal, true);
    await vi.runAllTimersAsync();
    await playing;
    expect(playback.activate).toHaveBeenCalledTimes(1);
  });

  it.each([1, 1.5, 2])('scales narration and pointer timing at %sx', async speed => {
    const playback = port();
    playback.speed = () => speed;
    let finished = false;
    const playing = playTour([step], playback, new AbortController().signal).then(() => { finished = true; });
    // 450ms pointer, 150ms click, 400ms narration.
    await vi.advanceTimersByTimeAsync(1000 / speed - 20);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(40);
    await playing;
    expect(finished).toBe(true);
    expect(playback.activate).toHaveBeenCalledExactlyOnceWith(step);
  });

  it('applies a speed change to the current reading hold without replaying its click', async () => {
    const playback = port();
    let speed = 1;
    playback.speed = () => speed;
    let finished = false;
    const playing = playTour([{ ...step, hold: 4000 }], playback, new AbortController().signal).then(() => { finished = true; });
    await vi.advanceTimersByTimeAsync(1600);
    speed = 2;
    await vi.advanceTimersByTimeAsync(1700);
    await playing;
    expect(finished).toBe(true);
    expect(playback.activate).toHaveBeenCalledTimes(1);
  });

  it('rebuilds earlier actions without narration, lands on the requested step and keeps it paused', async () => {
    const playback = port();
    let paused = true;
    playback.paused = () => paused;
    const destination = { ...step, id: 'destination', target: 'other-button' };
    const playing = playTour([step, destination], playback, new AbortController().signal, false, 1);
    await vi.advanceTimersByTimeAsync(800);
    expect(playback.activate).toHaveBeenNthCalledWith(1, step);
    expect(playback.activate).toHaveBeenNthCalledWith(2, destination);
    expect(playback.showStep).toHaveBeenCalledExactlyOnceWith(destination, 1);
    expect(playback.point).toHaveBeenCalledTimes(2);
    expect(playback.point).toHaveBeenNthCalledWith(1, 'other-button', false);
    await vi.advanceTimersByTimeAsync(3000);
    expect(playback.clearPointer).toHaveBeenCalledTimes(2);
    paused = false;
    await vi.runAllTimersAsync();
    await playing;
    expect(playback.activate).toHaveBeenCalledTimes(2);
  });

  it('allows jumping to the welcome step while paused', async () => {
    const playback = port();
    playback.paused = () => true;
    const abort = new AbortController();
    const welcome = { id: 'welcome', hold: 1800 };
    const playing = playTour([welcome], playback, abort.signal, false, 0).catch(() => {});
    await vi.advanceTimersByTimeAsync(100);
    expect(playback.showStep).toHaveBeenCalledExactlyOnceWith(welcome, 0);
    abort.abort();
    await playing;
  });

  it('keeps the loading timeout independent of playback speed', async () => {
    const playback = port();
    playback.speed = () => 2;
    playback.locate = () => false;
    let finished = false;
    const playing = playTour([step], playback, new AbortController().signal).catch(() => { finished = true; });
    await vi.advanceTimersByTimeAsync(14_000);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(1100);
    await playing;
    expect(finished).toBe(true);
  });
});

describe('first visit and replay', () => {
  it('Reset all closes an active hidden guide and restores the complete starting scene', () => {
    setState({ ...initialState, ready: true, lang: 'sv', theme: 'dark', numbering: 'universal', orbitMode: 'free' });
    actions.startGuide();
    actions.setGuideCollapsed(true);
    actions.enterDissect(36);
    actions.setDissectLevel(4);
    actions.setToothExplode(1);
    actions.setSurfaceFeatures(true);
    actions.openSearch(true);
    const run = getState().guideRunId;
    actions.resetAll();
    expect(getState()).toMatchObject({ guideOpen: false, guideCollapsed: false, guideRunId: run,
      ready: true, theme: 'dark', lang: 'sv', numbering: 'fdi', orbitMode: 'fixed',
      selectedId: null, selectionRequest: null, dissectFdi: null, dissectLevel: 0, toothExplode: 0,
      surfaceFeatures: false, developmentStage: null, explode: 0, labels: false, searchOpen: false, mobileSheet: 'none' });
    setState({ ...initialState });
  });
  it('collapses the guide without restarting it and preserves collapse during step preparation', () => {
    setState({ ...initialState });
    actions.startGuide();
    const run = getState().guideRunId;
    actions.setGuideCollapsed(true);
    expect(getState()).toMatchObject({ guideOpen: true, guideCollapsed: true, guideRunId: run });
    actions.resetGuideScene(true);
    expect(getState()).toMatchObject({ guideOpen: true, guideCollapsed: true, guideRunId: run });
    actions.setGuideCollapsed(false);
    expect(getState().guideRunId).toBe(run);
    actions.setGuideCollapsed(true);
    actions.closeGuide();
    expect(getState()).toMatchObject({ guideOpen: false, guideCollapsed: false });
    actions.setGuideCollapsed(true);
    actions.startGuide();
    expect(getState()).toMatchObject({ guideOpen: true, guideCollapsed: false });
    setState({ ...initialState });
  });
  it('keeps labels on through development, tooth exploration and nerves, then resets on completion', () => {
    setState({ ...initialState });
    actions.startGuide();
    actions.resetGuideScene(true);
    expect(getState().labels).toBe(true);
    actions.setDevelopmentStage('primary');
    actions.setDevelopmentStage('early-mixed');
    actions.setDevelopmentStage(null);
    actions.applyStudyPreset('dentition');
    expect(getState()).toMatchObject({ labels: true, categories: { muscles: 'off', skull: 'off', 'permanent-teeth': 'on' } });
    actions.enterDissect(36);
    actions.exitDissect();
    actions.applyStudyPreset('nerves');
    expect(getState().labels).toBe(true);
    actions.resetAll();
    actions.closeGuide();
    expect(getState()).toMatchObject({ guideOpen: false, labels: false, studyView: null, view: 'front', dissectFdi: null });
    setState({ ...initialState });
  });

  it('remembers a shown guide and tolerates blocked storage', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(needsFirstVisitGuide(storage)).toBe(true);
    rememberGuideVisit(storage);
    expect(values.get(GUIDE_VISIT_KEY)).toBe('seen');
    expect(needsFirstVisitGuide(storage)).toBe(false);
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(needsFirstVisitGuide(blocked)).toBe(true);
    expect(() => rememberGuideVisit(blocked)).not.toThrow();
  });

  it('resets the scene on exit while keeping preferences and allowing replay', () => {
    setState({ ...initialState, ready: true, lang: 'sv', theme: 'dark', numbering: 'universal' });
    actions.startGuide();
    const run = getState().guideRunId;
    actions.enterDissect(36);
    actions.setDissectLevel(4);
    actions.setToothExplode(1);
    actions.openSearch(true);
    actions.resetGuideScene();
    actions.closeGuide();
    expect(getState()).toMatchObject({ guideOpen: false, ready: true, lang: 'sv', theme: 'dark', numbering: 'universal',
      orbitMode: 'fixed', developmentStage: null, dissectFdi: null, dissectLevel: 0, toothExplode: 0, selectedId: null, searchOpen: false, mobileSheet: 'none' });
    actions.startGuide();
    expect(getState().guideRunId).toBe(run + 1);
    expect(getState().guideOpen).toBe(true);
    setState({ ...initialState });
  });
});

describe('tour content', () => {
  it('has meaningful captions in every language for each step, including the final state', () => {
    expect(FIRST_VISIT_TOUR.slice(1, 3).map(item => item.id)).toEqual(['open-skull', 'opening-teeth']);
    expect(new Set(FIRST_VISIT_TOUR.map(s => s.id)).size).toBe(FIRST_VISIT_TOUR.length);
    for (const lang of LANGS) for (const s of FIRST_VISIT_TOUR) {
      expect(TOUR_TEXT[lang].steps[s.id]?.[0].length, `${lang}/${s.id} title`).toBeGreaterThan(5);
      expect(TOUR_TEXT[lang].steps[s.id]?.[1].length, `${lang}/${s.id} caption`).toBeGreaterThan(30);
    }
    expect(FIRST_VISIT_TOUR.at(-1)).toMatchObject({ id: 'ready', action: 'finish' });
    expect(TOUR_TEXT.en.steps.ready[0]).toBe('Ready to explore');
  });
});
