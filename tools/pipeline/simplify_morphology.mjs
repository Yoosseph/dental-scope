/** Optional portable simplification when Python's native simplifier is unavailable.
 * Run on refresh_morphology.py JSON output before refresh_morphology.mjs.
 * Reject any result that opens a surface or reverses its signed volume.
 */
import { MeshoptSimplifier } from 'meshoptimizer';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

await MeshoptSimplifier.ready;
const [directory] = process.argv.slice(2);
function closed(indices, positions) {
  const edges = new Map();
  let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3);
    if (a === b || b === c || a === c) return false;
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const key = u < v ? `${u}:${v}` : `${v}:${u}`;
      const edge = edges.get(key) ?? [0, 0];
      edge[0]++; edge[1] += u < v ? 1 : -1;
      edges.set(key, edge);
    }
    const p = positions.slice(a * 3, a * 3 + 3);
    const q = positions.slice(b * 3, b * 3 + 3);
    const r = positions.slice(c * 3, c * 3 + 3);
    volume += p[0]*(q[1]*r[2]-q[2]*r[1]) + p[1]*(q[2]*r[0]-q[0]*r[2]) + p[2]*(q[0]*r[1]-q[1]*r[0]);
  }
  return volume > 0 && [...edges.values()].every(([count, winding]) => count === 2 && winding === 0);
}
for (const file of readdirSync(directory).filter(f => /^tooth-\d{2}\.json$/.test(f))) {
  const path = join(directory, file);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  for (const [key, mesh] of Object.entries(data)) {
    // Keep the external shell and its preserved crown vertices exactly as built.
    if (key.startsWith('tooth-') || !mesh?.indices || mesh.triangles <= 16000) continue;
    const positions = new Float32Array(mesh.positions);
    const [indices] = MeshoptSimplifier.simplify(new Uint32Array(mesh.indices), positions, 3, 48000, .001, ['LockBorder']);
    if (!closed(indices, positions)) throw new Error(`${key}: simplification would break closed geometry`);
    const bounds = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
    for (const i of indices) for (let k = 0; k < 3; k++) {
      bounds[0][k] = Math.min(bounds[0][k], positions[i*3+k]);
      bounds[1][k] = Math.max(bounds[1][k], positions[i*3+k]);
    }
    console.log(`${key}: ${mesh.triangles} -> ${indices.length / 3} triangles`);
    mesh.indices = Array.from(indices);
    mesh.triangles = indices.length / 3;
    mesh.bounds = bounds.map(row => row.map(v => Math.round(v * 10000) / 10000));
  }
  writeFileSync(path, JSON.stringify(data));
}
