#!/usr/bin/env python3
"""
Extract nerve and vessel centrelines from the Z-Anatomy atlas and register
them onto the BodyParts3D skull used by Dental Scope.

Z-Anatomy (https://github.com/Z-Anatomy/Models-of-human-anatomy) is a
CC BY-SA 4.0 Blender atlas built on BodyParts3D. Its nerves and vessels are
Bezier curves; this script samples them, fits the Z-Anatomy mandible and
maxillae onto the BodyParts3D ones (similarity ICP) and writes the result to
tools/pipeline/data/z-anatomy-neurovascular.json, which build_assets.py reads.
The output is committed, so a normal asset build does not need Blender.

Run with Blender's Python module (bpy 4.2 on Python 3.11) plus numpy, scipy,
trimesh and rtree:

    python tools/pipeline/extract_z_anatomy.py \
        --blend <Z-Anatomy/Startup.blend> --bp3d tools/pipeline/raw/stl

Startup.blend is inside Z-Anatomy.zip in the repository above.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import trimesh
from trimesh.registration import icp

import bpy  # noqa: E402  (Blender as a Python module)

# Z-Anatomy object names (".r" / ".l" are appended) that the app uses.
STRUCTURES = [
    # arteries
    "External carotid artery", "Maxillary artery", "Inferior alveolar artery",
    "Mental branch of inferior alveolar artery", "Posterior superior alveolar artery",
    "Descending palatine artery", "Greater palatine artery", "Buccal artery", "Facial artery",
    # veins
    "Internal jugular vein", "External jugular vein", "Retromandibular vein",
    "Anterior division of retromandibular vein", "Posterior division of retromandibular vein",
    "Maxillary veins", "Facial vein", "Common facial vein",
    # nerves
    "Trigeminal nerve (V)", "Maxillary nerve", "Anterior division of mandibular nerve",
    "Posterior division of mandibular nerve", "Inferior alveolar nerve", "Lingual nerve",
    "Mental nerve", "Buccal nerve",
]
BONES = {"Mandible": [52748], "Maxilla": [53649, 53650]}


def load(blend: Path, names: list[str]):
    with bpy.data.libraries.load(str(blend)) as (src, dst):
        dst.objects = [n for n in names if n in src.objects]
    for o in dst.objects:
        bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    return {o.name: o for o in dst.objects}, dg


def mesh_mm(o, dg) -> trimesh.Trimesh:
    oe = o.evaluated_get(dg)
    me = oe.to_mesh()
    me.calc_loop_triangles()
    v = np.array([x.co[:] for x in me.vertices])
    f = np.array([t.vertices[:] for t in me.loop_triangles])
    m = np.array(oe.matrix_world)
    oe.to_mesh_clear()
    return trimesh.Trimesh((np.c_[v, np.ones(len(v))] @ m.T)[:, :3] * 1000, f, process=False)


def sample_curve(o, dg, per_segment: int = 8):
    """Sample every Bezier spline in world millimetres: (points, radius factor)."""
    m = np.array(o.evaluated_get(dg).matrix_world)
    world = lambda co: (m @ np.r_[np.array(co[:3]), 1])[:3] * 1000  # noqa: E731
    out = []
    for s in o.data.splines:
        if s.type != "BEZIER" or len(s.bezier_points) < 2:
            continue
        bp = s.bezier_points
        pts, rad = [], []
        for i in range(len(bp) - 1):
            p0, h0, h1, p1 = world(bp[i].co), world(bp[i].handle_right), world(bp[i + 1].handle_left), world(bp[i + 1].co)
            for t in np.linspace(0, 1, per_segment, endpoint=False):
                pts.append((1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * h0 + 3 * (1 - t) * t ** 2 * h1 + t ** 3 * p1)
                rad.append(bp[i].radius * (1 - t) + bp[i + 1].radius * t)
        pts.append(world(bp[-1].co))
        rad.append(bp[-1].radius)
        out.append((np.array(pts), np.array(rad)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--blend", required=True, type=Path)
    ap.add_argument("--bp3d", required=True, type=Path)
    ap.add_argument("--out", type=Path, default=Path(__file__).parent / "data" / "z-anatomy-neurovascular.json")
    args = ap.parse_args()

    names = [f"{s}.{side}" for s in STRUCTURES for side in ("r", "l")] + ["Mandible", "Maxilla.r", "Maxilla.l"]
    objs, dg = load(args.blend, names)

    # Similarity fit Z-Anatomy jaws → BodyParts3D jaws. Mandible-weighted, since the
    # alveolar canal must land inside the BodyParts3D mandible.
    za_mand = mesh_mm(objs["Mandible"], dg)
    za_max = trimesh.util.concatenate([mesh_mm(objs["Maxilla.r"], dg), mesh_mm(objs["Maxilla.l"], dg)])
    bp_mand = trimesh.load(args.bp3d / "FMA52748.stl")
    bp_max = trimesh.util.concatenate([trimesh.load(args.bp3d / f"FMA{i}.stl") for i in BONES["Maxilla"]])
    s0 = float(np.mean(bp_mand.extents / za_mand.extents))
    init = np.eye(4)
    init[:3, :3] *= s0
    init[:3, 3] = bp_mand.bounds.mean(0) - s0 * za_mand.bounds.mean(0)
    rng = np.random.default_rng(0)
    src = np.vstack([za_mand.sample(8000, seed=rng), za_max.sample(3000, seed=rng)])
    tgt = trimesh.util.concatenate([bp_mand, bp_max])
    xf, _, cost = icp(src, tgt, initial=init, threshold=1e-6, max_iterations=100, scale=True)
    res = bp_mand.nearest.on_surface(trimesh.transform_points(za_mand.sample(3000, seed=rng), xf))[1]
    print(f"registration: scale {np.cbrt(np.linalg.det(xf[:3, :3])):.4f}, mandible residual median {np.median(res):.2f} mm")

    structures = {}
    for name in STRUCTURES:
        for side, suffix in (("right", "r"), ("left", "l")):
            o = objs.get(f"{name}.{suffix}")
            if o is None:
                raise SystemExit(f"missing Z-Anatomy object {name}.{suffix}")
            splines = []
            for pts, rad in sample_curve(o, dg):
                p = trimesh.transform_points(pts, xf)
                splines.append({"points": np.round(p, 2).tolist(), "radius": np.round(rad, 3).tolist()})
            structures.setdefault(name, {})[side] = splines

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps({
        "source": "Z-Anatomy, https://github.com/Z-Anatomy/Models-of-human-anatomy (Startup.blend)",
        "license": "CC BY-SA 4.0",
        "units": "mm, BodyParts3D coordinates (Z up, -Y anterior, +X patient-left)",
        "note": "Bezier centrelines sampled and registered onto the BodyParts3D jaws with a similarity ICP.",
        "registration": np.round(xf, 6).tolist(),
        "structures": structures,
    }, separators=(",", ":")))
    print(f"wrote {args.out} ({args.out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
