/** Decode shipped Meshopt assets and verify registry metadata before review. */
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readFileSync, statSync } from 'node:fs';
import { Vector3, Matrix4 } from 'three';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8'));
let count = 0, triangles = 0;
for (const [file, bytes] of Object.entries(manifest.files)) {
  if (!file.endsWith('.glb')) continue;
  if (statSync(`public/models/${file}`).size !== bytes) throw Error(`${file}: stale size`);
  const doc = await io.read(`public/models/${file}`);
  await doc.transform(dequantize());
  const expected = Object.keys(manifest.meshes).filter(key => manifest.meshes[key].file === file);
  const nodes = doc.getRoot().listNodes().filter(node => node.getMesh());
  for (const key of expected) {
    const node = nodes.find(node => node.getName() === key);
    if (!node) throw Error(`${file}: missing ${key}`);
    const primitive = node.getMesh().listPrimitives()[0];
    const positions = primitive.getAttribute('POSITION').getArray();
    const indices = primitive.getIndices().getArray();
    const metadata = manifest.meshes[key];
    if (indices.length / 3 !== metadata.triangles || !positions.every(Number.isFinite)) throw Error(`${key}: invalid geometry/count`);
    const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
    const matrix = new Matrix4().fromArray(node.getWorldMatrix());
    for (let i = 0; i < positions.length; i += 3) { const point = new Vector3(...positions.slice(i, i + 3)).applyMatrix4(matrix); min.min(point); max.max(point); }
    for (const [actual, declared] of [[min.toArray(), metadata.bounds[0]], [max.toArray(), metadata.bounds[1]]]) {
      if (actual.some((value, i) => Math.abs(value - declared[i]) > .002)) throw Error(`${key}: stale bounds`);
    }
    count++; triangles += indices.length / 3;
  }
  if (nodes.some(node => !expected.includes(node.getName()))) throw Error(`${file}: unregistered mesh`);
}
console.log(`Validated ${count} shipped meshes (${triangles.toLocaleString()} triangles): decompression, file sizes, nodes, finite coordinates, counts and bounds.`);
