import { describe, expect, it } from 'vitest';
import {
  PERMANENT_FDI,
  fdiToPalmer,
  fdiToUniversal,
  palmerToFdi,
  toothName,
  universalToFdi,
} from './notation';

describe('tooth notation', () => {
  it('maps well-known FDI ↔ Universal pairs', () => {
    expect(fdiToUniversal(11)).toBe(8);
    expect(fdiToUniversal(18)).toBe(1);
    expect(fdiToUniversal(21)).toBe(9);
    expect(fdiToUniversal(28)).toBe(16);
    expect(fdiToUniversal(38)).toBe(17);
    expect(fdiToUniversal(36)).toBe(19);
    expect(fdiToUniversal(31)).toBe(24);
    expect(fdiToUniversal(41)).toBe(25);
    expect(fdiToUniversal(46)).toBe(30);
    expect(fdiToUniversal(48)).toBe(32);
  });

  it('round-trips all 32 teeth', () => {
    const seen = new Set<number>();
    for (const fdi of PERMANENT_FDI) {
      const u = fdiToUniversal(fdi);
      seen.add(u);
      expect(universalToFdi(u)).toBe(fdi);
      expect(palmerToFdi(fdiToPalmer(fdi))).toBe(fdi);
    }
    expect(seen.size).toBe(32);
  });

  it('names teeth anatomically', () => {
    expect(toothName(11)).toBe('Maxillary right central incisor');
    expect(toothName(36)).toBe('Mandibular left first molar');
    expect(toothName(48)).toBe('Mandibular right third molar');
  });
});
