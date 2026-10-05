"""Refresh only tooth shells/enamel and surface annotations; keep other assets.

python refresh_morphology.py --bp3d raw/stl --out .cache/morphology
node refresh_morphology.mjs .cache/morphology
"""
import argparse
import json
import pickle
from pathlib import Path
import numpy as np
from build_assets import TEETH_FMA, load_stl, derive_third_molar, Space
from morphology import CrownRelief


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bp3d', type=Path, required=True)
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--only', default='')
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    teeth = {f: load_stl(args.bp3d, fma) for f, fma in TEETH_FMA.items() if fma}
    for q in (1, 2, 3, 4):
        teeth[q * 10 + 8] = derive_third_molar(teeth[q * 10 + 7], teeth[q * 10 + 6], q > 2)
    vertices = np.concatenate([m.vertices for m in teeth.values()])
    lo, hi = vertices.min(0), vertices.max(0)
    space = Space((lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2)
    only = {int(n) for n in args.only.split(',') if n}
    from geometry import decimate
    from build_assets import tooth_info
    for f, source in sorted(teeth.items()):
        if only and f not in only:
            continue
        cache = Path(__file__).parent / '.cache/build/cache' / f'layers-{"v8" if f in (38, 48) else "v7"}-{f}.pkl'
        with cache.open('rb') as handle:
            layers = pickle.load(handle)
        arch, _, kind = tooth_info(f)
        relief = CrownRelief(source, layers.frame, arch, kind, layers.cej_height)
        shell = relief.refine(source)
        enamel = relief.enamel(layers.meshes['enamel'], source)
        root = layers.frame.to_local(source.vertices)[:, 2] <= layers.cej_height
        assert np.allclose(shell.vertices[root], source.vertices[root]), f'Root changed for {f}'
        for key, mesh in [('tooth', shell), ('enamel', enamel)]:
            if not mesh.is_watertight or not mesh.is_winding_consistent or mesh.volume <= 0:
                raise ValueError(f'{key}-{f} is not a valid closed solid')
        data = {}
        meshes = {'tooth': shell, 'enamel': enamel}
        for key, mesh in layers.meshes.items():
            if key == 'enamel': continue
            meshes[key] = __import__('trimesh').Trimesh(relief.deform(mesh.vertices), mesh.faces.copy(), process=False)
        for key, mesh in meshes.items():
            app = space.mesh(decimate(mesh, 20000 if key == 'tooth' else 16000))
            data[f'{key}-{f}'] = dict(positions=app.vertices.astype(np.float32).ravel().tolist(), normals=app.vertex_normals.astype(np.float32).ravel().tolist(), indices=app.faces.ravel().tolist(), bounds=app.bounds.round(4).tolist(), triangles=len(app.faces))
        features = relief.annotations(shell)
        for entry in features:
            entry['anchor'] = space.p(entry['anchor']).round(5).tolist()
            if entry['path'] is not None:
                entry['path'] = space.p(entry['path']).round(5).tolist()
        data['features'] = features
        data['landmarks'] = {key: space.p(relief.deform(np.array([point]))[0]).round(5).tolist() for key, point in layers.landmarks.items()}
        (args.out / f'tooth-{f}.json').write_text(json.dumps(data))
        print(f'{f}: {len(features)} surface features; source roots preserved', flush=True)


if __name__ == '__main__':
    main()
