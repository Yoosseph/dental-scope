import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SurfaceFeatureLayer } from './SurfaceFeatureLayer';
import type { Manifest } from '../anatomy/types';

describe('surface overlays', () => {
  it('follows the full enamel transform and never disables depth occlusion', () => {
    const manifest = { teeth: { '16': { surfaceFeatures: [{key:'central-groove',anchor:[0,0,0],path:[[0,0,0],[1,0,0]]}] } } } as unknown as Manifest;
    const layer = new SurfaceFeatureLayer(manifest);
    const host = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    host.position.set(3,4,5); host.rotation.z=.4; host.updateMatrixWorld(true);
    layer.update(16,true,host);
    expect(layer.root.matrix.equals(host.matrixWorld)).toBe(true);
    const line = layer.root.children[0] as THREE.Line<THREE.BufferGeometry,THREE.LineBasicMaterial>;
    expect(line.material.depthTest).toBe(true);
    expect(line.material.depthWrite).toBe(false);
    layer.update(16,false,host);
    expect(layer.root.visible).toBe(false);
    host.visible=false;layer.update(16,true,host);
    expect(layer.root.visible).toBe(false);
    layer.dispose(); host.geometry.dispose(); host.material.dispose();
  });
});
