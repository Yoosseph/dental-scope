import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { prune, meshopt, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read('public/models/context.glb');
const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8'));
const data = JSON.parse(readFileSync('tools/pipeline/.cache/paranasal.json', 'utf8'));
// Remove retired teaching clusters from both packed geometry and the registry manifest.
for (const side of ['right', 'left']) {
  const key = `ethmoidal-air-cells-${side}`;
  doc.getRoot().listNodes().filter(n => n.getName() === key).forEach(n => n.dispose());
  delete manifest.meshes[key];
  delete data[key];
}
const buffer = doc.getRoot().listBuffers()[0];
const accessor = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
for (const [key, mesh] of Object.entries(data)) {
  const previous = doc.getRoot().listNodes().find(n => n.getName() === key); previous?.dispose();
  const node = doc.createNode(key).setMesh(doc.createMesh(key).addPrimitive(doc.createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', new Float32Array(mesh.positions)))
    .setAttribute('NORMAL', accessor('VEC3', new Float32Array(mesh.normals)))
    .setIndices(accessor('SCALAR', new Uint16Array(mesh.indices)))));
  doc.getRoot().listScenes()[0].addChild(node);
  manifest.meshes[key] = { stage: 2, file: 'context.glb', bounds: mesh.bounds, triangles: mesh.triangles, provenance: 'schematic' };
}
await doc.transform(prune(), reorder({ encoder: MeshoptEncoder }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write('public/models/context.glb', doc);
manifest.files['context.glb'] = statSync('public/models/context.glb').size;
writeFileSync('public/models/manifest.json', JSON.stringify(manifest));
console.log('Context asset and manifest updated.');
