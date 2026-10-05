/** Replace only refined tooth shells/enamel in the existing shipped files. */
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { prune, meshopt, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const [source, directory = 'public/models'] = process.argv.slice(2);
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const manifestPath = join(directory, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const core = await io.read(join(directory, 'core.glb'));
function replace(doc, key, data) {
  const node = doc.getRoot().listNodes().find(n => n.getName() === key);
  if (!node) throw new Error(`Missing ${key}`);
  const buffer = doc.getRoot().listBuffers()[0];
  const accessor = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  node.setMesh(doc.createMesh(key).addPrimitive(doc.createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', new Float32Array(data.positions)))
    .setAttribute('NORMAL', accessor('VEC3', new Float32Array(data.normals)))
    .setIndices(accessor('SCALAR', data.positions.length / 3 > 65535 ? new Uint32Array(data.indices) : new Uint16Array(data.indices)))))
    .setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  Object.assign(manifest.meshes[key], { bounds: data.bounds, triangles: data.triangles, provenance: 'schematic' });
}
async function write(doc, file) {
  await doc.transform(prune(), reorder({ encoder: MeshoptEncoder }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const bytes = await io.writeBinary(doc);
  for (let attempt = 0; ; attempt++) {
    try { writeFileSync(join(directory, file), bytes); break; }
    catch (error) { if (attempt >= 4) throw error; await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  manifest.files[file] = statSync(join(directory, file)).size;
}
for (const file of readdirSync(source).filter(f => /^tooth-\d{2}\.json$/.test(f))) {
  const fdi = file.match(/\d{2}/)[0];
  const data = JSON.parse(readFileSync(join(source, file), 'utf8'));
  replace(core, `tooth-${fdi}`, data[`tooth-${fdi}`]);
  const toothFile = `teeth/tooth-${fdi}.glb`;
  const tooth = await io.read(join(directory, toothFile));
  for (const [key, mesh] of Object.entries(data)) if (key !== `tooth-${fdi}` && key !== 'features' && key !== 'landmarks') replace(tooth, key.endsWith(`-${fdi}`) ? key : `${key}-${fdi}`, mesh);
  await write(tooth, toothFile);
  manifest.teeth[fdi].surfaceFeatures = data.features;
  manifest.teeth[fdi].landmarks = data.landmarks;
  manifest.teeth[fdi].provenance = 'schematic';
  console.log(`${fdi}: refined shell/enamel; crown tissues follow relief; root anatomy retained`);
}
await write(core, 'core.glb');
writeFileSync(manifestPath, JSON.stringify(manifest));
