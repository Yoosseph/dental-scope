"""Generate only the palatal nerves in app space, from the shipped manifest.

python tools/pipeline/refresh_palatal.py --manifest public/models/manifest.json --out tools/pipeline/.cache/palatal.json
node tools/pipeline/refresh_palatal.mjs tools/pipeline/.cache/palatal.json public/models
"""
import argparse
import json
from pathlib import Path

import numpy as np

from palatal import palatal_meshes, palatal_paths


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    paths = palatal_paths(manifest)
    nerves = {}
    for key, mesh in palatal_meshes(manifest).items():
        assert mesh.is_watertight and len(mesh.vertices) < 65536, key
        nerves[key] = {
            'positions': mesh.vertices.astype(np.float32).flatten().tolist(),
            'indices': mesh.faces.flatten().tolist(),
            'bounds': mesh.bounds.round(4).tolist(), 'triangles': len(mesh.faces),
            'paths': [np.asarray(p).round(4).tolist() for p, _, _ in paths[key]],
        }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(nerves))


if __name__ == '__main__':
    main()
