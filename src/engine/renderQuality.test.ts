import { describe, expect, it } from 'vitest';
import { renderPixelRatio } from './renderQuality';

describe('render resolution budget', () => {
  it('retains native resolution on a standard screen and detail on a high-DPI phone', () => {
    expect(renderPixelRatio(1280, 720, 1, false)).toBe(1);
    expect(renderPixelRatio(390, 844, 3, true)).toBe(1.5);
  });

  it('bounds GPU pixels on a Retina iPad in either orientation', () => {
    for (const [width, height] of [[1366, 1024], [1024, 1366]]) {
      const ratio = renderPixelRatio(width, height, 2, true);
      expect(width * height * ratio ** 2).toBeLessThanOrEqual(2_000_000.001);
      expect(ratio).toBeGreaterThan(1);
    }
  });

  it('bounds desktop buffers on 4K screens and handles an unmeasured canvas', () => {
    const ratio = renderPixelRatio(3840, 2160, 2, false);
    expect(3840 * 2160 * ratio ** 2).toBeLessThanOrEqual(4_000_000.001);
    expect(Number.isFinite(renderPixelRatio(0, 0, 0, true))).toBe(true);
  });
});
