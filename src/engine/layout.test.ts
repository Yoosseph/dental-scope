import { describe, expect, it } from 'vitest';
import { boardAssemblyKey, boardSlot, shelfLayout, type LayoutItem } from './layout';

const items: LayoutItem[] = [
  { key: 'skull-a', w: 6, h: 5, group: 0, order: 0 },
  { key: 'maxilla', w: 5, h: 2, group: 1, order: 0 },
  ...Array.from({ length: 16 }, (_, i) => ({ key: `upper-${i}`, w: 0.9, h: 2.2, group: 3, order: i })),
  ...Array.from({ length: 16 }, (_, i) => ({ key: `lower-${i}`, w: 0.8, h: 2.1, group: 4, order: i })),
  { key: 'mandible', w: 9, h: 5, group: 6, order: 0 },
  { key: 'nerve', w: 7, h: 0.5, group: 7, order: 0 },
];

const rect = (c: { x: number; y: number }, it: LayoutItem) => ({ x0: c.x - it.w / 2, x1: c.x + it.w / 2, y0: c.y - it.h / 2, y1: c.y + it.h / 2 });

it('reassembles source-bone partitions on the layout board', () => {
  expect(boardAssemblyKey('maxillary-alveolar-process-left')).toBe('maxilla-left');
  expect(boardAssemblyKey('mandibular-alveolar-process')).toBe('mandible-body');
  expect(boardAssemblyKey('mandibular-condyle-right')).toBe('mandible-body');
  expect(boardAssemblyKey('articular-fossa-left')).toBe('temporal-bone-left');
  expect(boardAssemblyKey('tooth-36')).toBe('tooth-36');
});

describe('shelfLayout', () => {
  for (const aspect of [16 / 9, 0.46]) {
    const { centers, bounds } = shelfLayout(items, aspect, 0.3);
    it(`places every item without overlap (aspect ${aspect.toFixed(2)})`, () => {
      expect(centers.size).toBe(items.length);
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++) {
          const a = rect(centers.get(items[i].key)!, items[i]);
          const b = rect(centers.get(items[j].key)!, items[j]);
          const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
          expect(overlap, `${items[i].key} × ${items[j].key}`).toBe(false);
        }
    });
    it(`keeps groups in bands from top to bottom and items in order (aspect ${aspect.toFixed(2)})`, () => {
      const y = (k: string) => centers.get(k)!.y;
      expect(y('skull-a')).toBeGreaterThan(y('maxilla'));
      expect(y('maxilla')).toBeGreaterThan(y('upper-0'));
      expect(y('upper-15')).toBeGreaterThan(y('lower-0'));
      expect(y('lower-15')).toBeGreaterThan(y('mandible'));
      // reading order within a row
      const row = items.filter((i) => i.group === 3 && Math.abs(y(i.key) - y('upper-0')) < 1e-9);
      for (let i = 1; i < row.length; i++) expect(centers.get(row[i].key)!.x).toBeGreaterThan(centers.get(row[i - 1].key)!.x);
    });
    it(`is centred and roughly matches the viewport shape (aspect ${aspect.toFixed(2)})`, () => {
      expect(Math.abs((bounds.x0 + bounds.x1) / 2)).toBeLessThan(1e-9);
      expect(Math.abs((bounds.y0 + bounds.y1) / 2)).toBeLessThan(1e-9);
      const a = (bounds.x1 - bounds.x0) / (bounds.y1 - bounds.y0);
      expect(a / aspect).toBeGreaterThan(0.4);
      expect(a / aspect).toBeLessThan(2.5);
    });
  }
});

describe('boardSlot', () => {
  it('orders the teeth as seen from the front, upper row above lower row', () => {
    const up = [18, 11, 21, 28].map((f) => boardSlot(`tooth-${f}`, ['permanent-teeth'], f));
    expect(new Set(up.map((s) => s.group)).size).toBe(1);
    expect(up.map((s) => s.order)).toEqual([...up.map((s) => s.order)].sort((a, b) => a - b));
    const low = boardSlot('tooth-48', ['permanent-teeth'], 48);
    expect(low.group).toBeGreaterThan(up[0].group);
    expect(boardSlot('tooth-48', [], 48).order).toBeLessThan(boardSlot('tooth-38', [], 38).order);
  });
  it('reads the head from top to bottom', () => {
    const slots = [
      boardSlot('frontal-bone', ['skull'], undefined),
      boardSlot('articular-disc-right', ['tmj'], undefined),
      boardSlot('infraorbital-nerve-right', ['nerves'], undefined),
      boardSlot('maxilla-right', ['maxilla'], undefined),
      boardSlot('gingiva-upper', ['gingiva'], undefined),
      boardSlot('tooth-11', [], 11),
      boardSlot('tooth-31', [], 31),
      boardSlot('gingiva-lower', ['gingiva'], undefined),
      boardSlot('mandible-body', ['mandible'], undefined),
      boardSlot('inferior-alveolar-nerve-right', ['nerves'], undefined),
      boardSlot('masseter-deep-right', ['muscles'], undefined),
    ];
    for (let i = 1; i < slots.length; i++) {
      const [a, b] = [slots[i - 1], slots[i]];
      expect(a.group < b.group || (a.group === b.group && a.order < b.order), `slot ${i}`).toBe(true);
    }
    // the upper and lower teeth each get a band (row group) of their own
    const bandOf = (i: number) => slots[i].group;
    expect(slots.filter((s) => s.group === bandOf(5))).toHaveLength(1);
    expect(slots.filter((s) => s.group === bandOf(6))).toHaveLength(1);
  });
  it('puts right-side structures before left ones', () => {
    expect(boardSlot('maxilla-right', ['maxilla'], undefined).order).toBeLessThan(boardSlot('maxilla-left', ['maxilla'], undefined).order);
    expect(boardSlot('mental-nerve-right-branch-1', ['nerves'], undefined).order).toBeLessThan(boardSlot('mental-nerve-left-branch-1', ['nerves'], undefined).order);
  });
});
