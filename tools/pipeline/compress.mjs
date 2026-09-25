#!/usr/bin/env node
/**
 * Compress intermediate GLBs into production assets.
 *   node tools/pipeline/compress.mjs <build dir> <public/models>
 * weld → dedup → quantize → EXT_meshopt_compression.
 */
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, weld, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [src = 'tools/pipeline/.cache/build', dst = 'public/models'] = process.argv.slice(2);
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const files = ['core.glb', 'context.glb', 'neurovascular.glb',
  ...readdirSync(join(src, 'teeth')).filter((f) => f.endsWith('.glb')).map((f) => `teeth/${f}`)];
mkdirSync(join(dst, 'teeth'), { recursive: true });
const sizes = {};
for (const f of files) {
  const doc = await io.read(join(src, f));
  await doc.transform(
    weld(),
    dedup(),
    prune(),
    reorder({ encoder: MeshoptEncoder }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  await io.write(join(dst, f), doc);
  sizes[f] = statSync(join(dst, f)).size;
  console.log(`${f.padEnd(24)} ${(statSync(join(src, f)).size / 1024).toFixed(0).padStart(6)} KB → ${(sizes[f] / 1024).toFixed(0).padStart(5)} KB`);
}
const manifest = JSON.parse(readFileSync(join(src, 'manifest.json'), 'utf8'));
manifest.files = sizes;
manifest.generated = new Date().toISOString().slice(0, 10);
writeFileSync(join(dst, 'manifest.json'), JSON.stringify(manifest));
console.log('manifest.json written');
