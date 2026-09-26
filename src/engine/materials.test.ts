import { describe, expect, it } from 'vitest';
import { styleFor, themedColor, THEME_LIGHTING } from './materials';

describe('light-theme tuning', () => {
  it('keeps dark-theme colours exactly as styled', () => {
    for (const key of ['bone', 'skull', 'enamel', 'shell', 'gingiva']) {
      expect(themedColor(key, 'dark').getHexString()).toBe(styleFor(key).color.slice(1));
    }
  });
  it('shades bone a little in the light theme so ivory teeth stand out', () => {
    for (const key of ['bone', 'alveolar', 'skull', 'condyle']) {
      const light = themedColor(key, 'light');
      const dark = themedColor(key, 'dark');
      expect(light.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(dark.getHSL({ h: 0, s: 0, l: 0 }).l);
      // subtle: every channel at most ~12 % darker, same hue
      for (const ch of ['r', 'g', 'b'] as const) expect(light[ch] / dark[ch]).toBeGreaterThan(0.88);
      expect(themedColor(key, 'light', 'cap').getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(themedColor(key, 'dark', 'cap').getHSL({ h: 0, s: 0, l: 0 }).l);
    }
  });
  it('leaves teeth and soft tissue colours alone', () => {
    for (const key of ['shell', 'enamel', 'gingiva', 'nerve']) {
      expect(themedColor(key, 'light').getHexString()).toBe(themedColor(key, 'dark').getHexString());
    }
  });
  it('lowers exposure slightly in the light theme', () => {
    expect(THEME_LIGHTING.light.exposure).toBeLessThan(THEME_LIGHTING.dark.exposure);
    expect(THEME_LIGHTING.light.exposure).toBeGreaterThan(0.85);
  });
});
