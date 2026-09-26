/**
 * Exploded views. Offsets are pure functions of the mesh key + registry data;
 * the engine interpolates them by the explode scalar.
 *
 * Arch level: skull ↑, maxillary complex ↑, mandibular complex ↓, teeth rise out
 * of their sockets along their long axis, gingiva lifts off the bone, nerves
 * and vessels move laterally in order, muscles move outward (the lip ring
 * moves forward and down, clear of the incisors).
 * Tooth level: layers separate along the tooth's own axes.
 */
import * as THREE from 'three';
import type { Registry } from '../anatomy/registry';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function toothVec(registry: Registry, fdi: number, key: 'axis' | 'buccal' | 'mesial'): THREE.Vector3 {
  const f = registry.get(`tooth-${fdi}`)?.tooth?.frame;
  return f ? V(...f[key]) : V(0, fdi < 30 ? -1 : 1, 0);
}

/** Arch-level offset at explode = 1 (app units, cm). `center` = mesh bounds centre. */
export function archOffset(registry: Registry, meshKey: string, center: THREE.Vector3): THREE.Vector3 {
  const owner = registry.get(registry.meshOwner.get(meshKey) ?? '');
  const cats = registry.categoriesOfMesh(meshKey);
  const side = Math.sign(center.x) || 1;
  const fdi = owner?.toothFdi;

  const upper = V(0, 2.3, 0);
  const lower = V(0, -2.3, 0);

  if (fdi !== undefined) {
    const jaw = fdi < 30 ? upper : lower;
    return jaw
      .clone()
      .addScaledVector(toothVec(registry, fdi, 'axis'), 1.35)
      .addScaledVector(toothVec(registry, fdi, 'buccal'), 0.3);
  }
  if (meshKey === 'gingiva-upper') return upper.clone().add(V(0, -0.75, 0.15));
  if (meshKey === 'gingiva-lower') return lower.clone().add(V(0, 0.75, 0.15));
  if (meshKey.startsWith('maxilla-') || meshKey.startsWith('palatine')) return upper.clone();
  if (meshKey.startsWith('mandible') || meshKey.startsWith('mandibular')) return lower.clone();
  if (meshKey.startsWith('articular-disc')) return V(side * 0.8, 1.1, 0);
  if (meshKey.startsWith('articular-fossa')) return V(side * 0.4, 3.9, 0);

  if (cats.includes('nerves') || cats.includes('arteries') || cats.includes('veins')) {
    const isUpper = /superior-alveolar|infraorbital/.test(meshKey);
    const base = isUpper ? upper.clone().add(V(0, 0.4, 0)) : lower.clone().add(V(0, -0.3, 0));
    const lat = cats.includes('arteries') ? 1.35 : cats.includes('veins') ? 1.8 : 0.95;
    if (meshKey.startsWith('lingual-nerve')) return base.add(V(-side * 0.9, 0, 0));
    if (meshKey.startsWith('incisive') || meshKey.startsWith('mental')) return base.add(V(side * 0.35, 0, 0.9));
    if (/anterior-superior/.test(meshKey)) return base.add(V(side * 0.3, 0, 0.9));
    return base.add(V(side * lat, 0, 0));
  }
  // The lip ring sits in front of the teeth and spans the midline, so a sideways push leaves it over the
  // incisors. Move it forward and just below the lower crowns instead (in front of the chin).
  if (meshKey === 'orbicularis-oris') return lower.clone().add(V(0, -2.6, 2.6));
  if (cats.includes('muscles')) {
    const vertical = center.y > 1.5 ? 3.2 : 0;
    return V(side * 3.2, vertical, center.z > 2.5 ? 2 : 0);
  }
  if (cats.includes('skull')) return V(0, 3.9, 0).add(V(side * (Math.abs(center.x) > 2 ? 0.6 : 0), 0, 0));
  return V();
}

/** Tooth-level offset at toothExplode = 1 for one layer mesh. */
export function toothLayerOffset(registry: Registry, meshKey: string): THREE.Vector3 {
  const fdi = registry.get(registry.meshOwner.get(meshKey) ?? '')?.toothFdi;
  if (fdi === undefined) return V();
  const axis = toothVec(registry, fdi, 'axis');
  const mesial = toothVec(registry, fdi, 'mesial');
  const kind = meshKey.replace(/-\d{2}$/, '');
  if (kind === 'enamel') return axis.clone().multiplyScalar(1.05);
  if (kind === 'dentin-coronal') return axis.clone().multiplyScalar(0.38);
  if (kind === 'dentin-radicular') return V();
  if (kind === 'cementum') return axis.clone().multiplyScalar(-0.55);
  if (kind === 'pdl') return axis.clone().multiplyScalar(-1.1);
  if (kind === 'pulp-chamber' || kind.startsWith('canal-')) return mesial.clone().multiplyScalar(-1.25).addScaledVector(axis, 0.12);
  return V();
}

/**
 * Tooth-level offset at toothExplode = 1 on the Root canals level, where only the pulp is shown:
 * the pulp chamber lifts toward the crown, the canals drop toward the apex and fan out by root
 * (mesial/distal, buccal/palatal-lingual), so the chamber–canal boundary and each canal read on their own.
 */
export function pulpLayerOffset(registry: Registry, meshKey: string): THREE.Vector3 {
  const fdi = registry.get(registry.meshOwner.get(meshKey) ?? '')?.toothFdi;
  if (fdi === undefined) return V();
  const axis = toothVec(registry, fdi, 'axis');
  const kind = meshKey.replace(/-\d{2}$/, '');
  if (kind === 'pulp-chamber') return axis.clone().multiplyScalar(0.9);
  if (!kind.startsWith('canal-')) return V();
  const mesial = toothVec(registry, fdi, 'mesial');
  const buccal = toothVec(registry, fdi, 'buccal');
  const out = axis.clone().multiplyScalar(-0.35);
  const name = kind.slice('canal-'.length);
  if (name.includes('mesio') || name.startsWith('mesial')) out.addScaledVector(mesial, 0.5);
  if (name.includes('disto') || name.startsWith('distal')) out.addScaledVector(mesial, -0.5);
  if (name.includes('buccal')) out.addScaledVector(buccal, 0.5);
  if (name.includes('palatal') || name.includes('lingual')) out.addScaledVector(buccal, -0.5);
  // second canal in the same root (e.g. mesial-1 / mesial-2): nudge apart along the buccal direction
  if (/-1$/.test(name)) out.addScaledVector(buccal, 0.3);
  if (/-2$/.test(name)) out.addScaledVector(buccal, -0.3);
  return out;
}
