import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CATEGORY_BY_ID } from '../anatomy/categories';
import { fibreAxis, styleFor, themedColor, THEME_LIGHTING } from './materials';

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

describe('surface detail for non-dental tissue', () => {
  const dental = ['shell', 'enamel', 'dentin-coronal', 'dentin-radicular', 'cementum', 'pulp-chamber', 'canal', 'pdl', 'gingiva', 'bone', 'alveolar', 'condyle', 'skull'];
  const context = ['muscle', 'nerve', 'artery', 'vein'];
  it('adds edge definition to muscles, nerves and vessels, and grain to muscles only', () => {
    for (const k of context) expect(styleFor(k).edge ?? 0, k).toBeGreaterThan(0);
    expect(styleFor('muscle').grain ?? 0).toBeGreaterThan(0);
    for (const k of ['nerve', 'artery', 'vein']) expect(styleFor(k).grain ?? 0, k).toBe(0);
    for (const k of dental) expect(styleFor(k).grain ?? 0, k).toBe(0);
    for (const k of ['shell', 'enamel', 'gingiva']) {
      expect(styleFor(k).edge ?? 0, k).toBeGreaterThan(0);
      expect(styleFor(k).mottle ?? 0, k).toBeGreaterThan(0);
    }
    for (const k of dental.filter((k) => !['shell', 'enamel', 'gingiva'].includes(k))) expect(styleFor(k).edge ?? 0, k).toBe(0);
  });
  it('keeps context tissue matte-ish and free of self-glow', () => {
    for (const k of context) {
      const st = styleFor(k);
      expect(st.roughness, k).toBeGreaterThanOrEqual(0.4);
      expect(st.clearcoat ?? 0, k).toBeLessThanOrEqual(0.2);
      expect(new THREE.Color(st.emissive ?? '#000').getHSL({ h: 0, s: 0, l: 0 }).l, k).toBeLessThan(0.03);
    }
  });
  it('shows the same colour in the layer legend as in 3D', () => {
    const pairs: [string, string][] = [['nerves', 'nerve'], ['arteries', 'artery'], ['veins', 'vein'], ['muscles', 'muscle']];
    for (const [cat, style] of pairs) expect(CATEGORY_BY_ID[cat as keyof typeof CATEGORY_BY_ID].color, cat).toBe(styleFor(style).color);
  });
  it('takes the fibre direction from the longest side of a muscle', () => {
    const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 4, 2));
    expect(fibreAxis(box).toArray()).toEqual([0, 1, 0]);
    expect(fibreAxis(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 1, 1))).toArray()).toEqual([1, 0, 0]);
  });
});
