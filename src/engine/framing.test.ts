import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Manifest } from '../anatomy/types';
import { dentitionFrame, skullOverviewFrame } from './framing';

const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest;
const skull = new THREE.Box3();
for (const mesh of Object.values(manifest.meshes)) {
  skull.expandByPoint(new THREE.Vector3(...mesh.bounds[0])).expandByPoint(new THREE.Vector3(...mesh.bounds[1]));
}

describe('skull overview and dental playback frames', () => {
  it.each([[1440, 900, 170], [1024, 768, 220], [390, 844, 65], [320, 568, 250]])(
    'keeps the whole skull in the clear canvas at %ix%i', (width, height, bottom) => {
      const viewport = { width, height, bottom, right: 0 };
      const frame = skullOverviewFrame(skull, 32, viewport);
      const camera = new THREE.PerspectiveCamera(32, width / height, 0.05, 200);
      camera.position.copy(frame.target).add(new THREE.Vector3(0, 0, frame.distance));
      camera.lookAt(frame.target);
      camera.setViewOffset(width, height, 0, bottom / 2, width, height);
      camera.updateMatrixWorld();
      for (const x of [skull.min.x, skull.max.x]) for (const y of [skull.min.y, skull.max.y]) for (const z of [skull.min.z, skull.max.z]) {
        const point = new THREE.Vector3(x, y, z).project(camera);
        const px = (point.x + 1) * width / 2;
        const py = (1 - point.y) * height / 2;
        expect(px).toBeGreaterThan(0);
        expect(px).toBeLessThan(width);
        expect(py).toBeGreaterThan(20);
        expect(py).toBeLessThan(height - bottom - 20);
      }
    },
  );

  it('starts at the skull centre, then moves closer to a distinct dental centre', () => {
    const overview = skullOverviewFrame(skull, 32, { width: 1440, height: 900, right: 0, bottom: 170 });
    const bounds = new THREE.Box3().setFromPoints(manifest.bounds.map((p) => new THREE.Vector3(...p)));
    const dentalCenter = bounds.getCenter(new THREE.Vector3()).add(new THREE.Vector3(0, -0.15, -0.2));
    const dental = dentitionFrame(skull, dentalCenter, 32, 1440 / 900);
    expect(overview.target.equals(skull.getCenter(new THREE.Vector3()))).toBe(true);
    expect(dental.target.equals(dentalCenter)).toBe(true);
    expect(overview.target.y - dental.target.y).toBeGreaterThan(5);
    expect(dental.distance).toBeLessThan(overview.distance);
  });
});
