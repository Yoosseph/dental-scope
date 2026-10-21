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


def _palatal_gingiva(tooth: dict, depth=0.5, lift=0.4) -> np.ndarray:
    """A point in the palatal gingiva of an upper tooth, from its cervical landmark and frame."""
    cervical = np.asarray(tooth['landmarks']['cervical-line'], float)
    return cervical - depth * np.asarray(tooth['frame']['buccal'], float) + np.array([0, lift, 0])


def palatal_paths(manifest: dict) -> dict[str, list[tuple[np.ndarray, float, float]]]:
    """Centrelines with start and end radius (cm) of both palatal nerves on each side."""
    out = {}
    teeth = manifest['teeth']
    for side, q, sign, col in (('right', 1, -1, 1), ('left', 2, 1, 2)):
        v2 = np.asarray(manifest['paths'][f'maxillary-nerve-{side}'][0], float)
        canal, palate = (np.asarray(p, float) for p in manifest['paths'][f'descending-palatine-artery-{side}'])
        top = int(np.argmax(np.diff(canal[:, 1]) < 0))       # the artery's turn at the top of its canal
        fossa = (v2[-2] + canal[top]) / 2                    # pterygopalatine fossa, below V2
        medial = np.array([-sign * MEDIAL, 0, 0])
        gum = {n: _palatal_gingiva(teeth[str(q * 10 + n)]) for n in range(1, 8)}

        # Greater palatine: down the canal with the artery, out of the foramen and forward in
        # the palatal groove to the premolars; short branches to the molar and premolar gingiva.
        # the palatal course is stored front to back; it rises into the canal at the foramen
        exit_ = int(np.argmax(palate[:, 1] > palate[: len(palate) // 2, 1].max() + 0.1))
        descent = [canal[i] + medial for i in range(top - 1, 2, -3)] + [palate[i] + medial for i in range(len(palate) - 1, exit_, -2)]
        groove = [palate[i] + medial for i in range(exit_, 9, -2)]
        trunk = [fossa, *descent, *groove, gum[4]]
        branches = []
        for n in (7, 6, 5):
            start = palate[min(range(exit_, 10, -1), key=lambda i: abs(palate[i, 2] - gum[n][2]))] + medial
            branches.append(([start, (start + gum[n]) / 2 + np.array([0, -0.05, 0]), gum[n]], 0.03, 0.02))
        out[f'greater-palatine-nerve-{side}'] = [(np.array(trunk), 0.055, 0.035), *branches]

        # Nasopalatine: across to the septum, down and forward on it, through the incisive canal.
        sphenopalatine = fossa + np.array([-sign * 0.65, -0.1, -0.1])
        septum = [np.array([x[col - 1], y, z]) for (y, z), *x in SEPTUM]
        (cy, cz), *cx = CANAL_TOP
        (fy, fz), *fx = FORAMEN
        foramen = np.array([fx[col - 1], fy, fz])
        nerve = [fossa, sphenopalatine, *septum, np.array([cx[col - 1], cy, cz]), foramen]
        fan = [([foramen, (foramen + gum[n]) / 2 + np.array([0, -0.04, 0]), gum[n]], 0.028, 0.02) for n in (1, 2, 3)]
        out[f'nasopalatine-nerve-{side}'] = [(np.array(nerve), 0.045, 0.032), *fan]
    return out


def palatal_meshes(manifest: dict) -> dict[str, trimesh.Trimesh]:
    """Tube meshes; every vertex follows the skull (jaw weight 1) when the arches separate."""
    meshes = {}
    for key, paths in palatal_paths(manifest).items():
        mesh = trimesh.util.concatenate([tube(np.asarray(p, float), r0, r1, sides=10, samples=6) for p, r0, r1 in paths])
        mesh.visual = trimesh.visual.ColorVisuals(mesh, vertex_colors=np.full((len(mesh.vertices), 4), 255, np.uint8))
        meshes[key] = mesh
    return meshes


def extend_palatal(scene, manifest: dict) -> None:
    """Add the palatal nerves to the neurovascular scene and record them in the manifest."""
    paths = palatal_paths(manifest)
    for key, mesh in palatal_meshes(manifest).items():
        if key in scene.geometry:
            scene.delete_geometry(key)
        scene.add_geometry(mesh, node_name=key, geom_name=key)
        manifest['meshes'][key] = {'stage': 3, 'file': 'neurovascular.glb', 'bounds': mesh.bounds.round(4).tolist(),
                                   'triangles': len(mesh.faces), 'provenance': 'schematic'}
        manifest['paths'][key] = [np.asarray(p).round(4).tolist() for p, _, _ in paths[key]]
