import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Registry } from '../anatomy/registry';
import type { Structure } from '../anatomy/types';
import { computeLabelPoint } from './labelPoint';

const frame = { origin: [0, 0, 0], axis: [0, 1, 0], mesial: [1, 0, 0], buccal: [0, 0, 1] };
const structures: Record<string, Partial<Structure>> = {
  'tooth-36': { id: 'tooth-36', toothFdi: 36, tooth: { frame } as Structure['tooth'] },
  'enamel-36': { id: 'enamel-36', toothFdi: 36 },
  'cementum-36': { id: 'cementum-36', toothFdi: 36 },
  'canal-distal-36': { id: 'canal-distal-36', toothFdi: 36 },
  mandible: { id: 'mandible' },
};
const registry = { get: (id: string) => structures[id] } as unknown as Registry;

function box(): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(1, 2, 0.5, 2, 2, 2).translate(0.2, 0.3, 0.1);
  geo.computeBoundingBox();
  return geo;
}

const at = (key: string, owner = key) => computeLabelPoint(box(), key, owner, registry).toArray().map((n) => Math.round(n * 1e4) / 1e4);

describe('computeLabelPoint', () => {
  it('puts the tooth shell label toward the crown, on the buccal side', () => {
    expect(at('tooth-36')).toEqual([0.7, 1.3, 0.35]);
  });
  it('puts enamel toward the crown', () => {
    expect(at('enamel-36')).toEqual([0.7, 1.3, 0.35]);
  });
  it('puts cementum toward the root', () => {
    expect(at('cementum-36')).toEqual([0.7, -0.7, 0.35]);
  });
  it('anchors canals at the centre of their bounds', () => {
    expect(at('canal-distal-36')).toEqual([0.2, 0.3, 0.1]);
  });
  it('anchors non-tooth meshes on the side away from the back of the head', () => {
    expect(at('mandible')).toEqual([0.7, 1.3, 0.35]);
  });
});
