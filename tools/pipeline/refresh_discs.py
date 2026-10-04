"""Generate only the two disc replacements in app space.

python tools/pipeline/refresh_discs.py --bp3d tools/pipeline/raw/stl --out tools/pipeline/.cache/discs.json
node tools/pipeline/refresh_discs.mjs tools/pipeline/.cache/discs.json public/models
"""
import argparse
import json
from pathlib import Path

import numpy as np

from build_assets import BONES, TEETH_FMA, Space, decimate, derive_third_molar, load_stl
from tmj import articular_disc


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bp3d', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    teeth = {f: load_stl(args.bp3d, fma) for f, fma in TEETH_FMA.items() if fma}
    for q in (1, 2, 3, 4):
        teeth[q * 10 + 8] = derive_third_molar(teeth[q * 10 + 7], teeth[q * 10 + 6], q > 2)
    vertices = np.concatenate([m.vertices for m in teeth.values()])
    lo, hi = vertices.min(0), vertices.max(0)
    space = Space((lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2)
    mandible = decimate(load_stl(args.bp3d, BONES['mandible']), 28000)
    fc = mandible.triangles_center
    mask = (fc[:, 1] > np.percentile(mandible.vertices[:, 1], 80)) & (fc[:, 2] > mandible.vertices[:, 2].max() - 10)
    replacements = {}
    for side in ('right', 'left'):
        side_mask = mask & ((fc[:, 0] < 0) if side == 'right' else (fc[:, 0] > 0))
        condyle = mandible.vertices[np.unique(mandible.faces[side_mask])]
        mesh = space.mesh(articular_disc(condyle))
        assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume > 0
        replacements[f'articular-disc-{side}'] = {
            'positions': mesh.vertices.astype(np.float32).flatten().tolist(),
            'normals': mesh.vertex_normals.astype(np.float32).flatten().tolist(),
            'indices': mesh.faces.flatten().tolist(),
            'bounds': mesh.bounds.round(4).tolist(), 'triangles': len(mesh.faces),
        }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(replacements))


if __name__ == '__main__':
    main()
