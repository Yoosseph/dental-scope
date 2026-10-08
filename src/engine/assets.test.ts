import * as THREE from 'three';
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';
import { expect, it } from 'vitest';
import { toFloatGeometry } from './assets';

it('keeps hit tests valid when GLTF primitives share triangle indices', () => {
  const source = new THREE.SphereGeometry(1, 32, 20);
  const other = source.clone().rotateY(1.2).scale(.6, 1.4, .8);
  other.setIndex(source.index);
  const originalIndices = Array.from(source.index!.array);
  const geometries = [toFloatGeometry(source), toFloatGeometry(other)];
  expect(geometries[0].index!.array).not.toBe(geometries[1].index!.array);
  for (const geometry of geometries) geometry.boundsTree = new MeshBVH(geometry);
  expect(Array.from(source.index!.array)).toEqual(originalIndices);

  const raycaster = new THREE.Raycaster();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  for (const geometry of geometries) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.updateMatrixWorld();
    for (const x of [-.45, 0, .45]) for (const y of [-.6, 0, .6]) {
      raycaster.set(new THREE.Vector3(x, y, 3), new THREE.Vector3(0, 0, -1));
      const ordinary: THREE.Intersection[] = [], accelerated: THREE.Intersection[] = [];
      THREE.Mesh.prototype.raycast.call(mesh, raycaster, ordinary);
      acceleratedRaycast.call(mesh, raycaster, accelerated);
      expect(ordinary.length).toBeGreaterThan(0);
      expect(accelerated.length).toBe(ordinary.length);
      expect(accelerated.map((hit) => hit.distance).sort()).toEqual(ordinary.map((hit) => hit.distance).sort());
    }
    geometry.dispose();
  }
  source.dispose(); other.dispose(); material.dispose();
});
