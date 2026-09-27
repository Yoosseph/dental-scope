import { describe, expect, it } from 'vitest';
import { levelShowing, levelShows } from './dissectLevels';

describe('levelShowing', () => {
  it.each([
    ['canal-mesiobuccal-36', 4],
    ['root-canals-36', 4],
    ['apical-foramen-distal-36', 4],
    ['enamel-36', 0],
    ['crown-36', 0],
    ['cej-36', 0],
    ['pdl-36', 1],
    ['cementum-36', 1],
    ['root-36', 1],
    ['apex-36', 1],
    ['dentin-36', 2],
    ['dentin-coronal-36', 2],
    ['dentin-radicular-36', 2],
    ['pulp-chamber-36', 3],
    ['pulp-horn-1-36', 3],
    ['pulp-36', 3],
    ['tooth-36', 0],
    ['mandible-body', 0],
  ])('%s → level %i', (id, level) => {
    expect(levelShowing(id)).toBe(level);
  });
});

describe('levelShows', () => {
  const table = (id: string) => [0, 1, 2, 3, 4].map((l) => levelShows(l, id));
  it('enamel and crown parts show on the outer levels', () => {
    expect(table('enamel-36')).toEqual([true, true, false, false, false]);
  });
  it('root surface parts show on the outer levels', () => {
    expect(table('pdl-36')).toEqual([true, true, false, false, false]);
  });
  it('dentin shows only on its own level', () => {
    expect(table('dentin-coronal-36')).toEqual([false, false, true, false, false]);
  });
  it('pulp and canals show from the pulp level on', () => {
    expect(table('pulp-chamber-36')).toEqual([false, false, false, true, true]);
    expect(table('canal-distal-36')).toEqual([false, false, false, true, true]);
  });
});
