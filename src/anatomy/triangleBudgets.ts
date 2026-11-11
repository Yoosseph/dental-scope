import type { Manifest } from './types.ts';

/** Triangle budgets for the tooth meshes, shared with tools/pipeline/refresh_morphology.py (budget()). */
export const TOOTH_SHELL_BUDGET = 20000;
export const TOOTH_LAYER_BUDGET = 16000;

/**
 * Every visitor downloads the 32 shells in core.glb, and the section tool and Quiz download every
 * tooth file. An unsimplified mesh once multiplied those downloads, so the build rejects one.
 */
export function triangleBudgetGaps(manifest: Manifest): string[] {
  return Object.entries(manifest.meshes).flatMap(([key, mesh]) => {
    const budget = /^tooth-\d{2}$/.test(key) ? TOOTH_SHELL_BUDGET : mesh.file.startsWith('teeth/') ? TOOTH_LAYER_BUDGET : null;
    return budget !== null && mesh.triangles > budget ? [`${key}: ${mesh.triangles} triangles (budget ${budget})`] : [];
  });
}
