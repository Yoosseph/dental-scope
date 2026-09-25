#!/usr/bin/env python3
"""
Dental Scope asset build.

    python tools/pipeline/build_assets.py --bp3d <path to BodyParts3D STL folder> --out tools/pipeline/.cache/build

Produces intermediate GLBs + manifest.json; `compress.mjs` then writes the
production files into public/models/.

Coordinates: BodyParts3D is in millimetres, Z up, -Y anterior, +X patient-left.
App space is centimetres, Y up, +Z anterior (toward the viewer), +X patient-left,
origin at the centre of the dentition.
"""
from __future__ import annotations

import argparse
import json
import os
import pickle
import sys
from multiprocessing import Pool
from pathlib import Path

import numpy as np
import trimesh
from scipy.spatial import cKDTree

sys.path.insert(0, str(Path(__file__).parent))
from geometry import decimate, ellipsoid_disc, submesh, surface_point, tube  # noqa: E402
from tooth_layers import Frame, build_tooth_layers, make_frame  # noqa: E402

# ---------------------------------------------------------------------------
# Source table
# ---------------------------------------------------------------------------
TYPES = ["central-incisor", "lateral-incisor", "canine", "first-premolar", "second-premolar",
         "first-molar", "second-molar", "third-molar"]

# FDI -> BodyParts3D FMA id (None = derived)
TEETH_FMA = {
    11: 55681, 12: 55680, 13: 55798, 14: 55689, 15: 55688, 16: 55698, 17: 55697, 18: None,
    21: 55682, 22: 55683, 23: 55799, 24: 55690, 25: 55691, 26: 55699, 27: 55700, 28: None,
    31: 57143, 32: 57141, 33: 55687, 34: 55693, 35: 55692, 36: 55704, 37: 55703, 38: None,
    41: 57142, 42: 57140, 43: 55686, 44: 55694, 45: 55695, 46: 55705, 47: 55706, 48: None,
}

CORE = {  # key -> FMA
    "gingiva-upper": 59763,
    "gingiva-lower": 59764,
}
BONES = {"mandible": 52748, "maxilla-right": 53649, "maxilla-left": 53650}

CONTEXT = {
    # skull context
    "palatine-bone-right": 53655, "palatine-bone-left": 53656,
    "zygomatic-bone-right": 52892, "zygomatic-bone-left": 52893,
    "temporal-bone-right": 52738, "temporal-bone-left": 52739,
    "sphenoid-bone": 52736, "occipital-bone": 52735, "frontal-bone": 52734,
    "parietal-bone-right": 52788, "parietal-bone-left": 52789,
    "vomer": 9710, "ethmoid-bone": 52740, "nasal-bone-right": 53647, "nasal-bone-left": 53648,
    "lacrimal-bone-right": 53645, "lacrimal-bone-left": 53646,
    "inferior-nasal-concha-right": 54737, "inferior-nasal-concha-left": 54738,
    "hyoid-bone": 52749,
    # muscles
    "masseter-superficial-right": 49001, "masseter-superficial-left": 49002,
    "masseter-deep-right": 49004, "masseter-deep-left": 49005,
    "temporalis-right": 49007, "temporalis-left": 49008,
    "medial-pterygoid-right": 49012, "medial-pterygoid-left": 49013,
    "lateral-pterygoid-lower-right": 49022, "lateral-pterygoid-lower-left": 49023,
    "lateral-pterygoid-upper-right": 49024, "lateral-pterygoid-upper-left": 49025,
    "buccinator-right": 46835, "buccinator-left": 46836,
    "mentalis-right": 46826, "mentalis-left": 46827,
    "orbicularis-oris": 46841,
}
CONTEXT_BUDGET = {"default": 3000, "temporalis": 5000, "frontal": 5000, "parietal": 4000, "occipital": 4000,
                  "sphenoid": 5000, "temporal-bone": 5000, "orbicularis": 3000}


def tooth_info(fdi: int):
    q, n = divmod(fdi, 10)
    arch = "maxillary" if q in (1, 2) else "mandibular"
    side = "right" if q in (1, 4) else "left"
    return arch, side, TYPES[n - 1]


def load_stl(folder: Path, fma: int) -> trimesh.Trimesh:
    m = trimesh.load(folder / f"FMA{fma}.stl")
    m.merge_vertices()
    m.fix_normals()
    return m


# ---------------------------------------------------------------------------
class Space:
    def __init__(self, y0: float, z0: float):
        self.y0, self.z0 = y0, z0

    def p(self, pts):
        pts = np.asarray(pts, float)
        out = np.empty_like(pts)
        out[..., 0] = pts[..., 0] / 10
        out[..., 1] = (pts[..., 2] - self.z0) / 10
        out[..., 2] = -(pts[..., 1] - self.y0) / 10
        return out

    def d(self, v):  # direction
        v = np.asarray(v, float)
        return np.array([v[0], v[2], -v[1]])

    def mesh(self, m: trimesh.Trimesh) -> trimesh.Trimesh:
        out = trimesh.Trimesh(self.p(m.vertices), m.faces.copy(), process=False)
        return out


def derive_third_molar(m2: trimesh.Trimesh, m1: trimesh.Trimesh) -> trimesh.Trimesh:
    c2, c1 = m2.vertices.mean(0), m1.vertices.mean(0)
    distal = c2 - c1
    distal[2] = 0
    distal /= np.linalg.norm(distal)
    width = np.ptp(m2.vertices @ distal)
    out = m2.copy()
    out.vertices = (out.vertices - c2) * 0.9 + c2 + distal * width * 0.93
    return out


def _layers_job(args):
    fdi, verts, faces, arch, ttype, frame_d, cache = args
    if cache and os.path.exists(cache):
        return fdi, pickle.load(open(cache, "rb"))
    mesh = trimesh.Trimesh(verts, faces, process=False)
    fr = Frame(**{k: np.array(v) for k, v in frame_d.items()})
    L = build_tooth_layers(mesh, arch, ttype, fr)
    if cache:
        pickle.dump(L, open(cache, "wb"))
    print(f"  tooth {fdi}: {', '.join(L.meshes)}", flush=True)
    return fdi, L


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bp3d", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--jobs", type=int, default=2)
    ap.add_argument("--only", type=str, default="", help="comma separated FDI numbers for tooth layers")
    args = ap.parse_args()
    out: Path = args.out
    (out / "teeth").mkdir(parents=True, exist_ok=True)
    cache = out / "cache"
    cache.mkdir(exist_ok=True)

    print("Loading BodyParts3D meshes…")
    teeth = {f: load_stl(args.bp3d, fma) for f, fma in TEETH_FMA.items() if fma}
    for q in (1, 2, 3, 4):
        teeth[q * 10 + 8] = derive_third_molar(teeth[q * 10 + 7], teeth[q * 10 + 6])

    allv = np.concatenate([m.vertices for m in teeth.values()])
    lo, hi = allv.min(0), allv.max(0)
    S = Space(y0=(lo[1] + hi[1]) / 2, z0=(lo[2] + hi[2]) / 2)

    # ---- tooth frames ---------------------------------------------------
    cent = {f: m.vertices.mean(0) for f, m in teeth.items()}
    frames = {}
    for f, m in teeth.items():
        arch, side, ttype = tooth_info(f)
        q, n = divmod(f, 10)
        crown_dir = np.array([0, 0, -1.0]) if arch == "maxillary" else np.array([0, 0, 1.0])
        if n == 1:
            other = {1: 21, 2: 11, 3: 41, 4: 31}[q]
            mesial = cent[other] - cent[f]
        else:
            mesial = cent[q * 10 + n - 1] - cent[f]
        mesial[2] = 0
        jaw = [cent[x] for x in cent if (x // 10 in (1, 2)) == (arch == "maxillary")]
        centre = np.mean(jaw, axis=0)
        centre[1] += 10  # arch centre sits behind the incisors
        buccal = cent[f] - centre
        buccal[2] = 0
        frames[f] = make_frame(m, crown_dir, mesial / np.linalg.norm(mesial), buccal / np.linalg.norm(buccal))

    # ---- tooth layers (slow; cached) -----------------------------------
    only = {int(x) for x in args.only.split(",") if x}
    jobs = []
    for f in sorted(teeth):
        if only and f not in only:
            continue
        arch, side, ttype = tooth_info(f)
        fr = frames[f]
        jobs.append((f, teeth[f].vertices, teeth[f].faces, arch, ttype,
                     dict(origin=fr.origin, axis=fr.axis, mesial=fr.mesial, buccal=fr.buccal),
                     str(cache / f"layers-{f}.pkl")))
    print(f"Modelling internal anatomy for {len(jobs)} teeth…")
    with Pool(args.jobs) as pool:
        layers = dict(pool.map(_layers_job, jobs))

    manifest = {"units": "cm", "up": "+Y", "anterior": "+Z", "patientLeft": "+X",
                "source": "BodyParts3D 3.0 (DBCLS), CC BY-SA 2.1 JP", "meshes": {}, "teeth": {}, "paths": {},
                "landmarks": {}}

    def register(key, mesh_app, stage, file, provenance, source_ref=None):
        b = mesh_app.bounds
        manifest["meshes"][key] = dict(stage=stage, file=file, bounds=np.round(b, 4).tolist(),
                                       triangles=int(len(mesh_app.faces)), provenance=provenance,
                                       **({"sourceRef": f"FMA{source_ref}"} if source_ref else {}))

    scenes = {"core": trimesh.Scene(), "context": trimesh.Scene(), "neurovascular": trimesh.Scene()}

    def add(scene_name, key, mesh_world, provenance, source_ref=None, stage=None):
        m = S.mesh(mesh_world)
        scenes[scene_name].add_geometry(m, node_name=key, geom_name=key)
        register(key, m, stage or {"core": 1, "context": 2, "neurovascular": 3}[scene_name],
                 f"{scene_name}.glb", provenance, source_ref)

    # ---- core: teeth shells ----------------------------------------------
    print("Core: teeth, gingiva, bone…")
    for f, m in sorted(teeth.items()):
        prov = "source" if TEETH_FMA[f] else "derived"
        add("core", f"tooth-{f}", decimate(m, 2600), prov, TEETH_FMA[f])
        arch, side, ttype = tooth_info(f)
        fr = frames[f]
        info = dict(arch=arch, side=side, type=ttype, provenance=prov,
                    frame=dict(origin=S.p(fr.origin).round(4).tolist(), axis=S.d(fr.axis).round(4).tolist(),
                               mesial=S.d(fr.mesial).round(4).tolist(), buccal=S.d(fr.buccal).round(4).tolist()))
        if f in layers:
            L = layers[f]
            info["roots"] = L.roots
            info["landmarks"] = {k: S.p(v).round(4).tolist() for k, v in L.landmarks.items()}
            info["layers"] = list(L.meshes)
            info["asset"] = f"teeth/tooth-{f}.glb"
        manifest["teeth"][str(f)] = info

    for key, fma in CORE.items():
        add("core", key, decimate(load_stl(args.bp3d, fma), 7000), "source", fma)

    # ---- bone partition ---------------------------------------------------
    def root_points(fdis):
        pts = []
        for f in fdis:
            fr = frames[f]
            v = teeth[f].vertices
            loc = fr.to_local(v)
            zc = layers[f].cej_height if f in layers else np.percentile(loc[:, 2], 60)
            pts.append(v[loc[:, 2] < zc - 0.5])
        return np.concatenate(pts)

    lower = [f for f in teeth if f // 10 in (3, 4)]
    upper_r = [f for f in teeth if f // 10 == 1]
    upper_l = [f for f in teeth if f // 10 == 2]

    # decimate before partitioning so the pieces share identical borders (no cracks)
    mand = decimate(load_stl(args.bp3d, BONES["mandible"]), 17000)
    tree = cKDTree(root_points(lower))
    fc = mand.triangles_center
    alv = tree.query(fc, distance_upper_bound=4.0)[0] < 4.0
    # condyles: top of the posterior ramus
    post = fc[:, 1] > np.percentile(mand.vertices[:, 1], 80)
    zc_top = mand.vertices[:, 2].max()
    condyle = post & (fc[:, 2] > zc_top - 10) & ~alv
    cond_r = condyle & (fc[:, 0] < 0)
    cond_l = condyle & (fc[:, 0] > 0)
    body = ~alv & ~condyle
    add("core", "mandible-body", submesh(mand, body), "source", 52748)
    add("core", "mandibular-alveolar-process", submesh(mand, alv), "derived", 52748)
    add("core", "mandibular-condyle-right", submesh(mand, cond_r), "derived", 52748)
    add("core", "mandibular-condyle-left", submesh(mand, cond_l), "derived", 52748)

    for side, ups in (("right", upper_r), ("left", upper_l)):
        mx = decimate(load_stl(args.bp3d, BONES[f"maxilla-{side}"]), 9000)
        tr = cKDTree(root_points(ups))
        c = mx.triangles_center
        a = tr.query(c, distance_upper_bound=4.0)[0] < 4.0
        add("core", f"maxilla-{side}", submesh(mx, ~a), "source", BONES[f"maxilla-{side}"])
        add("core", f"maxillary-alveolar-process-{side}", submesh(mx, a), "derived", BONES[f"maxilla-{side}"])

    # ---- context ------------------------------------------------------------
    print("Context: skull & muscles…")
    temporal = {}
    for key, fma in CONTEXT.items():
        m = load_stl(args.bp3d, fma)
        budget = next((v for k, v in CONTEXT_BUDGET.items() if key.startswith(k)), CONTEXT_BUDGET["default"])
        if key.startswith("temporal-bone"):
            temporal[key.split("-")[-1]] = decimate(m, 6500)
            continue
        add("context", key, decimate(m, budget), "source", fma)

    # TMJ: articular fossa region of the temporal bone + schematic disc
    for side, mask in (("right", cond_r), ("left", cond_l)):
        cverts = mand.vertices[np.unique(mand.faces[mask])]
        top = cverts[np.argmax(cverts[:, 2])]
        head = cverts[cverts[:, 2] > top[2] - 5]
        hc = head.mean(0)
        cov = np.cov((head - hc).T)
        w, vec = np.linalg.eigh(cov)
        major = vec[:, 2]
        major[2] = 0
        major /= np.linalg.norm(major)
        up = np.array([0, 0, 1.0])
        minor = np.cross(up, major)
        axes = np.stack([major, minor, up])
        ml = np.ptp(head @ major)
        apw = np.ptp(head @ minor)
        tb = temporal[side]
        tc = tb.triangles_center
        fossa = (np.linalg.norm(tc - (top + np.array([0, 0, 2.0])), axis=1) < max(ml, 12) * 0.62) & (tc[:, 2] > top[2] - 1.0)
        add("context", f"temporal-bone-{side}", submesh(tb, ~fossa), "source",
            CONTEXT[f"temporal-bone-{side}"])
        add("context", f"articular-fossa-{side}", submesh(tb, fossa), "derived",
            CONTEXT[f"temporal-bone-{side}"])
        disc = ellipsoid_disc(top + np.array([0, 0, 1.4]), axes, (ml * 0.55, apw * 0.75, 1.1), concavity=0.45)
        add("context", f"articular-disc-{side}", disc, "schematic")
        manifest["landmarks"][f"condyle-top-{side}"] = S.p(top).round(4).tolist()

    # ---- neurovascular (schematic) -----------------------------------------
    print("Neurovascular paths (schematic)…")
    mand_full = mand

    def apex(f):
        return layers[f].landmarks["apex"] if f in layers else teeth[f].vertices[np.argmin(teeth[f].vertices[:, 2])]

    def add_path(key, pts, r0, r1=None, provenance="schematic"):
        pts = np.asarray(pts)
        m = tube(pts, r0, r1, sides=10, samples=8)
        add("neurovascular", key, m, provenance)
        manifest["paths"][key] = S.p(pts).round(4).tolist()

    vy = mand_full.vertices
    for side, q, sgn in (("right", 4, -1), ("left", 3, 1)):
        a8, a7, a6, a5, a4 = (apex(q * 10 + n) for n in (8, 7, 6, 5, 4))
        a3, a2, a1 = (apex(q * 10 + n) for n in (3, 2, 1))
        occl = np.mean([teeth[q * 10 + n].vertices[:, 2].max() for n in (6, 7)])
        # ramus section at occlusal level, posterior to the third molar
        y_back = teeth[q * 10 + 8].vertices[:, 1].max() + 6
        ring = vy[(np.abs(vy[:, 2] - (occl - 3)) < 1.5) & (vy[:, 1] > y_back) & (np.sign(vy[:, 0]) == sgn)]
        ya, yb = ring[:, 1].min(), ring[:, 1].max()
        x_med = ring[:, 0][np.argmin(np.abs(ring[:, 0]))]
        foramen = np.array([x_med + sgn * 1.2, ya + 0.45 * (yb - ya), occl - 4])
        start = foramen + np.array([-sgn * 6, 4, 16])
        dn = np.array([0, 0, -3.2])
        lingual = np.array([-sgn * 1.0, 0, 0])
        canal = [start, foramen + np.array([-sgn * 0.5, 0, 3]), foramen,
                 a8 + dn * 1.2 + lingual, a7 + dn + lingual, a6 + dn + lingual * 0.6, a5 + dn]
        # mental foramen: between the premolars, on the buccal surface
        mid = (a4 + a5) / 2 + np.array([0, 0, -4.0])
        hit = surface_point(mand_full, mid, np.array([sgn, -0.2, 0]))
        mental_f = hit if hit is not None else mid + np.array([sgn * 5, 0, 0])
        inner_mf = mental_f - np.array([sgn, -0.2, 0]) * 1.5
        add_path(f"inferior-alveolar-nerve-{side}", canal + [inner_mf], 1.1, 0.95)
        add_path(f"inferior-alveolar-artery-{side}",
                 [p + np.array([-sgn * 0.9, 0, 1.0]) for p in canal[1:]] + [inner_mf + np.array([0, 0, 0.9])], 0.45, 0.35)
        add_path(f"inferior-alveolar-vein-{side}",
                 [p + np.array([sgn * 0.3, 0.4, -1.1]) for p in canal[1:]] + [inner_mf + np.array([0, 0, -1.0])], 0.6, 0.45)
        # mental nerve: exits the foramen and fans toward lip & chin
        mout = mental_f + np.array([sgn * 1.2, -0.6, 0.3])
        for i, d in enumerate([np.array([sgn * 1.2, -3.5, 5]), np.array([sgn * 1.8, -4.5, 2.2]), np.array([sgn * 1.5, -4, -1.5])]):
            add_path(f"mental-nerve-{side}" if i == 0 else f"mental-nerve-{side}-branch-{i}",
                     [inner_mf, mental_f, mout, mout + d * 0.5 + np.array([sgn, 0, 0]), mout + d], 0.6 if i == 0 else 0.4, 0.25)
        # incisive nerve continues in bone beneath the anterior apices
        add_path(f"incisive-nerve-{side}", [inner_mf, a4 + dn, a3 + dn * 1.3, a2 + dn, a1 + dn + np.array([-sgn * 1.5, 0, 0])], 0.55, 0.3)
        # lingual nerve: medial to the ramus, close to the lingual plate at the third molar, then to the tongue
        crest8 = teeth[q * 10 + 8].vertices[:, 2].min() + 2
        near8 = vy[(np.abs(vy[:, 1] - a8[1]) < 2) & (np.sign(vy[:, 0]) == sgn) & (np.abs(vy[:, 2] - crest8) < 3)]
        x_ling = near8[:, 0][np.argmin(np.abs(near8[:, 0]))] if len(near8) else a8[0] - sgn * 4
        l1 = start + np.array([sgn * 1.0, -6, 1])
        l2 = np.array([x_ling - sgn * 1.6, a8[1] + 3, crest8 - 3])
        l3 = np.array([x_ling - sgn * 4.0, a6[1], crest8 - 9])
        l4 = np.array([x_ling - sgn * 9.0, a4[1], crest8 - 8])
        l5 = np.array([x_ling - sgn * 12.0, a3[1] - 3, crest8 - 2])
        add_path(f"lingual-nerve-{side}", [start + np.array([sgn * 1, -3, 6]), l1, l2, l3, l4, l5], 0.9, 0.6)
        manifest["landmarks"][f"mandibular-foramen-{side}"] = S.p(foramen).round(4).tolist()
        manifest["landmarks"][f"mental-foramen-{side}"] = S.p(mental_f).round(4).tolist()

    # superior alveolar nerves (schematic)
    for side, q, sgn in (("right", 1, -1), ("left", 2, 1)):
        mx = load_stl(args.bp3d, BONES[f"maxilla-{side}"])
        ap_ = {n: apex(q * 10 + n) for n in range(1, 9)}
        upz = np.array([0, 0, 3.0])
        # infraorbital foramen: anterior surface above the first premolar
        probe = ap_[4] + np.array([sgn * -2, 4, 17])
        hit = surface_point(mx, probe, np.array([sgn * 0.3, -1, 0]))
        io_f = hit if hit is not None else probe + np.array([0, -8, 0])
        io_in = io_f + np.array([0, 3, 1.5])
        io_back1 = io_f + np.array([-sgn * 1, 16, 4])
        io_back2 = io_f + np.array([-sgn * 2, 32, 6])
        add_path(f"infraorbital-nerve-{side}", [io_back2, io_back1, io_in, io_f,
                                                io_f + np.array([sgn * 1.2, -1.5, -0.8]), io_f + np.array([sgn * 2.2, -2.6, -2.4])], 1.0, 0.6)
        # posterior superior alveolar: from behind the tuberosity into the molar apices
        t8 = teeth[q * 10 + 8].vertices
        tub = np.array([ap_[8][0] + sgn * 3, t8[:, 1].max() + 4, ap_[8][2] + 10])
        add_path(f"posterior-superior-alveolar-nerve-{side}",
                 [io_back2 + np.array([sgn * 2, -2, -3]), tub, ap_[8] + upz + np.array([sgn * 1.5, 0, 0]),
                  ap_[7] + upz, ap_[6] + upz], 0.55, 0.4)
        add_path(f"middle-superior-alveolar-nerve-{side}",
                 [io_back1 + np.array([sgn * 1.5, 0, -1]), ap_[5] + upz * 2.2, ap_[5] + upz, ap_[4] + upz], 0.45, 0.35)
        add_path(f"anterior-superior-alveolar-nerve-{side}",
                 [io_in, ap_[3] + upz * 2.5, ap_[3] + upz, ap_[2] + upz, ap_[1] + upz + np.array([-sgn * 1.5, 0, 0])], 0.5, 0.35)
        manifest["landmarks"][f"infraorbital-foramen-{side}"] = S.p(io_f).round(4).tolist()

    # ---- tooth internal assets -------------------------------------------
    print("Tooth assets…")
    for f, L in layers.items():
        sc = trimesh.Scene()
        for name, m in L.meshes.items():
            key = f"{name}-{f}"
            ma = S.mesh(m)
            sc.add_geometry(ma, node_name=key, geom_name=key)
            register(key, ma, 4, f"teeth/tooth-{f}.glb", "modeled")
        sc.export(out / "teeth" / f"tooth-{f}.glb")

    for name, sc in scenes.items():
        sc.export(out / f"{name}.glb")
    manifest["bounds"] = S.p(np.array([lo, hi])).round(4).tolist()
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print("Done.", {k: len(v.geometry) for k, v in scenes.items()}, "teeth assets:", len(layers))


if __name__ == "__main__":
    main()
