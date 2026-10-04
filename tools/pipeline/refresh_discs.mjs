/** Replace only discs in the shipped context file; preserve all other meshes. */
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [source, directory = 'public/models'] = process.argv.slice(2);
const replacements = JSON.parse(readFileSync(source, 'utf8'));
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder});
const path = join(directory, 'context.glb');
const doc = await io.read(path);
const root = doc.getRoot();
const buffer = root.listBuffers()[0];
const manifestPath = join(directory, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const [key, data] of Object.entries(replacements)) {
  if (!/^articular-disc-(left|right)$/.test(key)) throw new Error(`Unexpected replacement ${key}`);
  const node = root.listNodes().find(n => n.getName() === key);
  if (!node || !manifest.meshes[key]) throw new Error(`Missing disc ${key}`);
  const position = doc.createAccessor().setType('VEC3').setArray(new Float32Array(data.positions)).setBuffer(buffer);
  const normal = doc.createAccessor().setType('VEC3').setArray(new Float32Array(data.normals)).setBuffer(buffer);
  const indices = doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(data.indices)).setBuffer(buffer);
  const mesh = doc.createMesh(key).addPrimitive(doc.createPrimitive()
    .setAttribute('POSITION', position).setAttribute('NORMAL', normal).setIndices(indices));
  node.setMesh(mesh).setMatrix([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  Object.assign(manifest.meshes[key], {bounds:data.bounds, triangles:data.triangles});
}
await doc.transform(prune());
await io.write(path, doc);
manifest.files['context.glb'] = statSync(path).size;
writeFileSync(manifestPath, JSON.stringify(manifest));
console.log('Updated both discs; preserved other context geometry.');
