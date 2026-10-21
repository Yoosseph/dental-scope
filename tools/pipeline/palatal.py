"""Schematic palatal nerves: greater palatine and nasopalatine (V2, via the pterygopalatine fossa).

Neither BodyParts3D nor the Z-Anatomy curves used here include them. The paths are
teaching schematics in app cm, placed from this model's own landmarks: they leave the
fossa below the atlas maxillary nerve; the greater palatine nerve shares the canal and
palatal groove of the atlas descending palatine artery and sends short branches to the
palatal gingiva of the posterior teeth; the nasopalatine nerve crosses to the nasal
septum, runs down and forward on the vomer and leaves the incisive foramen behind the
central incisors. Courses and territories follow the references in
docs/innervation-identification.md; they show relationships, not a measured dissection.
"""
from __future__ import annotations

import numpy as np
import trimesh

from geometry import tube

# Points beside this skull's vomer (it deviates to the right), 0.7 mm from its surface,
# measured from the shipped context mesh: (y, z) → x of the right and the left septal face.
SEPTUM = [((4.55, -2.30), -0.53, 0.29), ((3.75, -1.00), -0.44, -0.11), ((3.00, 0.55), -0.51, -0.07)]
CANAL_TOP = ((2.30, 1.25), -0.30, 0.05)   # nasal opening of each incisive canal
FORAMEN = ((1.47, 1.58), -0.07, 0.05)     # the shared incisive foramen, below the papilla
MEDIAL = 0.09                             # nerve beside the artery, on its medial side
SIDES = (('right', 1, -1), ('left', 2, 1))  # side, FDI quadrant, sign of x

Path = tuple[np.ndarray, float, float]   # centreline, start and end radius (cm)


def _septal(point, side: str) -> np.ndarray:
    """A measured septal point on the given side, as (x, y, z)."""
    (y, z), right, left = point
    return np.array([right if side == 'right' else left, y, z])


def _palatal_gingiva(tooth: dict, depth=0.5, lift=0.4) -> np.ndarray:
    """A point in the palatal gingiva of an upper tooth, from its cervical landmark and frame."""
    cervical = np.asarray(tooth['landmarks']['cervical-line'], float)
    return cervical - depth * np.asarray(tooth['frame']['buccal'], float) + np.array([0, lift, 0])


def _twig(start: np.ndarray, end: np.ndarray, sag: float, r0: float) -> Path:
    """A short branch that dips slightly between its ends."""
    return np.array([start, (start + end) / 2 + np.array([0, -sag, 0]), end]), r0, 0.02


def _greater_palatine(fossa, canal, top, palate, medial, gum) -> list[Path]:
    """Down the canal with the artery, out of the foramen and forward in the palatal groove to
    the premolars; short branches to the molar and premolar gingiva."""
    # the palatal course is stored front to back; it rises into the canal at the foramen
    exit_ = int(np.argmax(palate[:, 1] > palate[: len(palate) // 2, 1].max() + 0.1))
    descent = [canal[i] + medial for i in range(top - 1, 2, -3)] + [palate[i] + medial for i in range(len(palate) - 1, exit_, -2)]
    groove = [palate[i] + medial for i in range(exit_, 9, -2)]
    trunk = (np.array([fossa, *descent, *groove, gum[4]]), 0.055, 0.035)
    branches = []
    for n in (7, 6, 5):
        start = palate[min(range(exit_, 10, -1), key=lambda i: abs(palate[i, 2] - gum[n][2]))] + medial
        branches.append(_twig(start, gum[n], 0.05, 0.03))
    return [trunk, *branches]


def _nasopalatine(fossa, sign, side, gum) -> list[Path]:
    """Across to the septum, down and forward on it, through the incisive canal; a fan to the
    palatal gingiva of the anterior teeth."""
    sphenopalatine = fossa + np.array([-sign * 0.65, -0.1, -0.1])
    foramen = _septal(FORAMEN, side)
    nerve = [fossa, sphenopalatine, *(_septal(p, side) for p in SEPTUM), _septal(CANAL_TOP, side), foramen]
    return [(np.array(nerve), 0.045, 0.032), *(_twig(foramen, gum[n], 0.04, 0.028) for n in (1, 2, 3))]


def palatal_paths(manifest: dict) -> dict[str, list[Path]]:
    """Centrelines with start and end radius (cm) of both palatal nerves on each side."""
    out = {}
    for side, q, sign in SIDES:
        v2 = np.asarray(manifest['paths'][f'maxillary-nerve-{side}'][0], float)
        canal, palate = (np.asarray(p, float) for p in manifest['paths'][f'descending-palatine-artery-{side}'])
        top = int(np.argmax(np.diff(canal[:, 1]) < 0))       # the artery's turn at the top of its canal
        fossa = (v2[-2] + canal[top]) / 2                    # pterygopalatine fossa, below V2
        medial = np.array([-sign * MEDIAL, 0, 0])
        gum = {n: _palatal_gingiva(manifest['teeth'][str(q * 10 + n)]) for n in range(1, 8)}
        out[f'greater-palatine-nerve-{side}'] = _greater_palatine(fossa, canal, top, palate, medial, gum)
        out[f'nasopalatine-nerve-{side}'] = _nasopalatine(fossa, sign, side, gum)
    return out


def palatal_nerves(manifest: dict):
    """(key, tube mesh, rounded paths) per nerve; every vertex follows the skull (jaw weight 1)
    when the arches separate."""
    for key, paths in palatal_paths(manifest).items():
        mesh = trimesh.util.concatenate([tube(np.asarray(p, float), r0, r1, sides=10, samples=6) for p, r0, r1 in paths])
        mesh.visual = trimesh.visual.ColorVisuals(mesh, vertex_colors=np.full((len(mesh.vertices), 4), 255, np.uint8))
        yield key, mesh, [np.asarray(p).round(4).tolist() for p, _, _ in paths]


def extend_palatal(scene, manifest: dict) -> None:
    """Add the palatal nerves to the neurovascular scene and record them in the manifest."""
    for key, mesh, paths in palatal_nerves(manifest):
        if key in scene.geometry:
            scene.delete_geometry(key)
        scene.add_geometry(mesh, node_name=key, geom_name=key)
        manifest['meshes'][key] = {'stage': 3, 'file': 'neurovascular.glb', 'bounds': mesh.bounds.round(4).tolist(),
                                   'triangles': len(mesh.faces), 'provenance': 'schematic'}
        manifest['paths'][key] = paths
