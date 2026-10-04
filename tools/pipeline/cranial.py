"""Head/upper-neck teaching paths added to the existing atlas dentition.

The complete sampled CN V root is atlas data. New VII/IX/X/XII and V1 paths,
skull-exit markers and canal envelopes are schematic: control points show
relationships, not patient measurements or a complete cranial-nerve atlas.
References and limits: docs/feedback-anatomy.md. Coordinates below are app cm.
"""
from __future__ import annotations
import numpy as np
import trimesh
from geometry import tube, tube_polyline


def extend_cranial(scene, core, manifest, space, atlas):
    def put(key, paths, provenance='schematic', radius=0.07, sampled=False):
        parts = []
        for path in paths:
            p = np.asarray(path, float)
            if sampled:
                mesh = tube_polyline(p, np.full(len(p), radius), sides=10)
            else:
                mesh = tube(p, radius, radius * 0.65, sides=10, samples=6)
            # Existing explode convention: 0 follows mandible, 1 follows skull.
            w = np.clip((mesh.vertices[:, 1] + 1) / 5, 0, 1)
            if key.startswith(('trigeminal-', 'ophthalmic-')):
                w[:] = 1
            mesh.visual = trimesh.visual.ColorVisuals(mesh, vertex_colors=np.c_[np.repeat((w * 255).round()[:, None], 3, 1), np.full(len(w), 255)].astype(np.uint8))
            parts.append(mesh)
        mesh = trimesh.util.concatenate(parts)
        if key in scene.geometry:
            scene.delete_geometry(key)
        scene.add_geometry(mesh, node_name=key, geom_name=key)
        manifest['meshes'][key] = {'stage': 3, 'file': 'neurovascular.glb', 'bounds': mesh.bounds.round(4).tolist(), 'triangles': len(mesh.faces), 'provenance': provenance}
        manifest['paths'][key] = [np.asarray(p).round(4).tolist() for p in paths]

    def landmark(key, point):
        manifest['landmarks'][key] = np.asarray(point).round(4).tolist()

    def surface(key, target, outward=0.08):
        """Use the source muscle surface to keep facial branches superficial."""
        m = core.get(key)
        if m is None:
            return np.asarray(target, float)
        p = m.vertices[np.argmin(np.linalg.norm(m.vertices - target, axis=1))].copy()
        p[0] += np.sign(p[0]) * outward
        return p

    for side, sign in [('right', -1), ('left', 1)]:
        def p(x, y, z):
            return np.array([sign * x, y, z], float)

        raw = atlas['structures']['Trigeminal nerve (V)'][side][0]['points']
        root = space.p(raw)
        put(f'trigeminal-nerve-{side}', [root], 'atlas', 0.11, sampled=True)
        ganglion = root[-1]
        orbit = p(1.8, 5.6, -3.2)
        landmark(f'superior-orbital-fissure-{side}', orbit)
        v1 = [ganglion, p(1.6, 5.7, -4.7), orbit, p(2.0, 6.6, -0.8), p(2.2, 8.2, 0.5)]
        put(f'ophthalmic-nerve-{side}', [v1], radius=0.06)
        v2 = manifest['paths'][f'maxillary-nerve-{side}'][0]
        v3 = manifest['paths'][f'mandibular-nerve-{side}'][0]
        landmark(f'foramen-rotundum-{side}', v2[len(v2)//2])
        landmark(f'foramen-ovale-{side}', v3[-1])

        # VII: temporal-bone segment, stylomastoid exit, parotid branch point.
        exit7 = p(4.6, 2.7, -6.1)
        junction = p(5.4, 2.0, -4.8)
        put(f'facial-nerve-{side}', [[p(1.0, 4.5, -7.4), p(3.4, 4.6, -6.8), p(4.4, 4.8, -5.9), p(4.8, 3.8, -6.0), exit7, junction]], radius=0.075)
        landmark(f'stylomastoid-foramen-{side}', exit7)
        masseter = f'masseter-superficial-{side}'
        for branch, target, mid in [
            ('temporal', p(4.0, 8.0, -0.7), p(5.7, 4.6, -3.0)),
            ('zygomatic', p(3.0, 5.2, 0.2), p(5.5, 3.8, -2.4)),
            ('buccal', p(1.7, 0.9, 3.2), p(5.1, 1.7, -2.1)),
            ('marginal-mandibular', p(1.6, -1.5, 2.8), p(4.7, -1.4, -2.3)),
            ('cervical', p(3.2, -2.7, -2.7), p(4.9, -1.5, -3.7)),
        ]:
            mid = surface(masseter, mid)
            put(f'facial-{branch}-branch-{side}', [[junction, mid, target]], radius=0.045)

        jugular = p(2.8, 3.6, -7.4)
        hypoglossal = p(1.5, 3.1, -7.4)
        landmark(f'jugular-foramen-{side}', jugular)
        landmark(f'hypoglossal-canal-{side}', hypoglossal)
        put(f'glossopharyngeal-nerve-{side}', [[p(0.9, 3.6, -8.0), jugular, p(2.9, 1.4, -6.4), p(2.4, 0.0, -4.8), p(1.6, -0.3, -2.5)]], radius=0.055)
        put(f'vagus-nerve-{side}', [[p(1.0, 3.3, -8.0), jugular + p(0.1, -0.1, -0.1), p(2.9, 1.4, -6.3), p(2.8, -1.0, -5.7), p(2.8, -3.0, -5.5)]], radius=0.065)
        put(f'hypoglossal-nerve-{side}', [[p(0.7, 2.9, -7.8), hypoglossal, p(2.4, 1.0, -6.4), p(2.6, -1.7, -4.9), p(1.9, -1.6, -2.8), p(1.0, -0.8, -0.8)]], radius=0.055)

        # A separate selectable envelope exposes the named bony passage.
        trunk = np.asarray(manifest['paths'][f'inferior-alveolar-nerve-{side}'][0])
        start = np.asarray(manifest['landmarks'][f'mandibular-foramen-{side}'])
        end = np.asarray(manifest['landmarks'][f'mental-foramen-{side}'])
        a, b = [int(np.argmin(np.linalg.norm(trunk - t, axis=1))) for t in (start, end)]
        canal = trunk[min(a, b):max(a, b)+1]
        put(f'mandibular-canal-{side}', [canal], radius=0.18, sampled=True)
        condyle = np.mean(manifest['meshes'][f'mandibular-condyle-{side}']['bounds'], axis=0)
        landmark(f'articular-eminence-{side}', condyle + [0, 0.25, 1.1])

    pivot = np.mean([np.mean(manifest['meshes'][f'mandibular-condyle-{s}']['bounds'], axis=0) for s in ['right', 'left']], axis=0)
    manifest['jawMotion'] = {'pivot': pivot.round(4).tolist(), 'translation': [0, -0.75, 1.2], 'rotation': 0.42, 'provenance': 'schematic'}


if __name__ == '__main__':
    # Incremental rebuild preserves the current gingiva and tooth assets.
    import json
    from pathlib import Path
    from build_assets import Space, TEETH_FMA, load_stl, derive_third_molar
    build = Path('tools/pipeline/.cache/build')
    raw = Path('tools/pipeline/raw/stl')
    manifest = json.loads((build / 'manifest.json').read_text())
    teeth = {f: load_stl(raw, ref) for f, ref in TEETH_FMA.items() if ref}
    for q in (1, 2, 3, 4):
        teeth[q*10+8] = derive_third_molar(teeth[q*10+7], teeth[q*10+6], q > 2)
    vertices = np.concatenate([m.vertices for m in teeth.values()])
    lo, hi = vertices.min(0), vertices.max(0)
    space = Space((lo[1]+hi[1])/2, (lo[2]+hi[2])/2)
    scene = trimesh.load(build / 'neurovascular.glb', force='scene')
    core = dict(trimesh.load(build / 'core.glb', force='scene').geometry)
    core.update(trimesh.load(build / 'context.glb', force='scene').geometry)
    atlas = json.loads(Path('tools/pipeline/data/z-anatomy-neurovascular.json').read_text())
    extend_cranial(scene, core, manifest, space, atlas)
    scene.export(build / 'neurovascular.glb')
    (build / 'manifest.json').write_text(json.dumps(manifest))
    print('Extended cranial anatomy; existing core and tooth geometry preserved.')
