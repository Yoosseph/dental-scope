import { describe, expect, it } from 'vitest';
import { QUIET_OPACITY, REGIONAL_OPACITY, isSolid, quietLevel, quietOpacity } from './recede';

describe('nerve and vessel receding', () => {
  const nerve = { hiTarget: 0, nerve: true };
  const vessel = { hiTarget: 0 };
  const trunk = { hiTarget: 0, regional: true };

  it('keeps dental nerves at full strength, also while the jaws are dissected', () => {
    expect(quietLevel(nerve, 0)).toBe(0);
    expect(quietLevel(nerve, 1)).toBe(0);
  });

  it('fades dental vessels only while dissected', () => {
    expect(quietLevel(vessel, 0)).toBe(0);
    expect(quietLevel(vessel, 1)).toBe(1);
    expect(quietOpacity(vessel, 1)).toBeCloseTo(QUIET_OPACITY);
  });

  it('keeps regional trunks quiet at rest and nearly gone while dissected', () => {
    const rest = quietOpacity(trunk, quietLevel(trunk, 0));
    expect(rest).toBeGreaterThan(0.25);
    expect(rest).toBeLessThan(0.5);
    expect(quietOpacity(trunk, quietLevel(trunk, 1))).toBeCloseTo(REGIONAL_OPACITY);
  });

  it('brings anything selected or hovered back to full strength', () => {
    for (const e of [nerve, vessel, trunk]) expect(quietLevel({ ...e, hiTarget: 1 }, 1)).toBe(0);
  });

  it('lets clicks and labels pass through quiet paths', () => {
    expect(isSolid({ visual: 'on', quiet: 0 })).toBe(true);
    expect(isSolid({ visual: 'on', quiet: 0.7 })).toBe(false);
    expect(isSolid({ visual: 'ghost', quiet: 0 })).toBe(false);
  });
});
