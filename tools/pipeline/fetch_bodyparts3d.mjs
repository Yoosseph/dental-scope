#!/usr/bin/env node
/**
 * Fetch the BodyParts3D STL files used by Dental Scope from the verbatim
 * mirror https://github.com/Kevin-Mattheus-Moerman/BodyParts3D
 * (content licence: CC BY-SA 2.1 Japan, © DBCLS).
 * Files land in tools/pipeline/raw/stl (git-ignored).
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

const ids = readFileSync(new URL('./fma_ids.txt', import.meta.url), 'utf8').split(/\s+/).filter(Boolean);
const raw = 'tools/pipeline/raw';
mkdirSync(raw, { recursive: true });
if (!existsSync(`${raw}/repo`)) {
  execSync(`git clone --depth 1 --filter=blob:none --no-checkout https://github.com/Kevin-Mattheus-Moerman/BodyParts3D ${raw}/repo`, { stdio: 'inherit' });
}
const paths = ids.map((id) => `assets/BodyParts3D_data/stl/FMA${id}.stl`);
execSync(`git -C ${raw}/repo sparse-checkout set --no-cone ${paths.join(' ')} assets/BodyParts3D_data/LICENSE_content`, { stdio: 'inherit' });
execSync(`git -C ${raw}/repo checkout`, { stdio: 'inherit' });
execSync(`rm -rf ${raw}/stl && ln -s repo/assets/BodyParts3D_data/stl ${raw}/stl`);
console.log(`Fetched ${ids.length} meshes into ${raw}/stl`);
