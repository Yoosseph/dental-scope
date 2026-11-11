import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Manifest } from './types';
import { TOOTH_LAYER_BUDGET, TOOTH_SHELL_BUDGET, triangleBudgetGaps } from './triangleBudgets';

const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest;

/** Triangles per node name, read from a GLB's JSON chunk (accessor counts need no decoding). */
function glbTriangles(file: string): Map<string, number> {
  const bytes = readFileSync(`public/models/${file}`);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8')) as {
    nodes: { name: string; mesh?: number }[];
    meshes: { primitives: { indices: number }[] }[];
    accessors: { count: number }[];
  };
  return new Map(gltf.nodes.filter((n) => n.mesh !== undefined).map((n) => [
    n.name,
    gltf.meshes[n.mesh!].primitives.reduce((sum, p) => sum + gltf.accessors[p.indices].count / 3, 0),
  ]));
}

describe('tooth triangle budgets', () => {
  it('keeps every tooth shell and tissue layer within its budget', () => {
    expect(triangleBudgetGaps(manifest)).toEqual([]);
  });

  it('reads the shipped geometry: manifest counts match the GLB files', () => {
    const files = new Set(Object.entries(manifest.meshes).filter(([key, m]) => /^tooth-\d{2}$/.test(key) || m.file.startsWith('teeth/')).map(([, m]) => m.file));
    for (const file of files) {
      const counts = glbTriangles(file);
      for (const [key, mesh] of Object.entries(manifest.meshes)) if (mesh.file === file && counts.has(key)) expect(counts.get(key), key).toBe(mesh.triangles);
    }
  });

  it('names each mesh over its budget', () => {
    const over: Manifest = { ...manifest, meshes: {
      'tooth-46': { ...manifest.meshes['tooth-46'], triangles: TOOTH_SHELL_BUDGET + 1 },
      'cementum-46': { ...manifest.meshes['cementum-46'], triangles: TOOTH_LAYER_BUDGET + 1 },
      'gingiva-upper': { ...manifest.meshes['gingiva-upper'], triangles: 1e6 },
    } };
    expect(triangleBudgetGaps(over)).toEqual([
      `tooth-46: ${TOOTH_SHELL_BUDGET + 1} triangles (budget ${TOOTH_SHELL_BUDGET})`,
      `cementum-46: ${TOOTH_LAYER_BUDGET + 1} triangles (budget ${TOOTH_LAYER_BUDGET})`,
    ]);
  });
});
