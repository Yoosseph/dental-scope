/** Add or replace only the palatal nerves in the shipped neurovascular file; preserve all other meshes. */
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [source, directory = 'public/models'] = process.argv.slice(2);
const nerves = JSON.parse(readFileSync(source, 'utf8'));
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder});
const path = join(directory, 'neurovascular.glb');
const doc = await io.read(path);
const root = doc.getRoot();
const buffer = root.listBuffers()[0];
const scene = root.listScenes()[0];
const manifestPath = join(directory, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

/**
 * Quantize like the other nodes: normalized int16 positions, dequantized by a uniform node
 * scale/offset. Bounds come from the exact positions: the rounded manifest bounds would let
 * edge vertices overflow int16.
 */
function quantize(positions) {
  const axis = a => positions.filter((_, i) => i % 3 === a);
  const lo = [0, 1, 2].map(a => Math.min(...axis(a))), hi = [0, 1, 2].map(a => Math.max(...axis(a)));
  const centre = [0, 1, 2].map(a => (lo[a] + hi[a]) / 2);
  const scale = Math.max(...[0, 1, 2].map(a => (hi[a] - lo[a]) / 2));
  const array = Int16Array.from(positions, (v, i) => Math.max(-32767, Math.min(32767, Math.round((v - centre[i % 3]) / scale * 32767))));
  return { array, matrix: [scale,0,0,0, 0,scale,0,0, 0,0,scale,0, ...centre, 1] };
}

for (const [key, data] of Object.entries(nerves)) {
  if (!/^(greater-palatine|nasopalatine)-nerve-(left|right)$/.test(key)) throw new Error(`Unexpected nerve ${key}`);
  const count = data.positions.length / 3;
  const { array, matrix } = quantize(data.positions);
  const position = doc.createAccessor().setType('VEC3').setArray(array).setNormalized(true).setBuffer(buffer);
  // jaw weight 1 in every vertex colour: the palate moves with the skull (see src/engine/assets.ts)
  const color = doc.createAccessor().setType('VEC4').setArray(new Uint8Array(count * 4).fill(255)).setNormalized(true).setBuffer(buffer);
  const indices = doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(data.indices)).setBuffer(buffer);
  const mesh = doc.createMesh(key).addPrimitive(doc.createPrimitive()
    .setAttribute('POSITION', position).setAttribute('COLOR_0', color).setIndices(indices));
  let node = root.listNodes().find(n => n.getName() === key);
  if (!node) scene.addChild(node = doc.createNode(key));
  node.setMesh(mesh).setMatrix(matrix);
  manifest.meshes[key] = {stage: 3, file: 'neurovascular.glb', bounds: data.bounds, triangles: data.triangles, provenance: 'schematic'};
  manifest.paths[key] = data.paths;
}
await doc.transform(prune());
await io.write(path, doc);
manifest.files['neurovascular.glb'] = statSync(path).size;
writeFileSync(manifestPath, JSON.stringify(manifest));
console.log(`Updated ${Object.keys(nerves).length} palatal nerves; preserved other neurovascular geometry.`);
