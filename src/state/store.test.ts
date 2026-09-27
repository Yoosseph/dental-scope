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
