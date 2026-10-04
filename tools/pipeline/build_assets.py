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
from geometry import catmull_rom, decimate, ellipsoid_disc, orient_outward, submesh, tube_polyline  # noqa: E402
from sinus import build_sinus  # noqa: E402
from gingiva import expose_third_molar_crowns  # noqa: E402
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
# Preserve the source's anatomical ridges and muscle insertions. Meshopt still
# keeps these static context meshes small, and most are translucent or hidden.
CONTEXT_BUDGET = {"default": 9000, "temporalis": 15000, "frontal": 15000, "parietal": 12000, "occipital": 12000,
                  "sphenoid": 15000, "temporal-bone": 15000, "orbicularis": 9000}


def tooth_info(fdi: int):
    q, n = divmod(fdi, 10)
    arch = "maxillary" if q in (1, 2) else "mandibular"
    side = "right" if q in (1, 4) else "left"
    return arch, side, TYPES[n - 1]


def load_stl(folder: Path, fma: int) -> trimesh.Trimesh:
    m = trimesh.load(folder / f"FMA{fma}.stl")
    m.merge_vertices()
    return orient_outward(m)


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
        if m.visual.kind == "vertex":  # neurovascular jaw weights travel as vertex colours
            out.visual = trimesh.visual.ColorVisuals(out, vertex_colors=m.visual.vertex_colors.copy())
        return out


def derive_third_molar(m2: trimesh.Trimesh, m1: trimesh.Trimesh, lower: bool) -> trimesh.Trimesh:
    c2, c1 = m2.vertices.mean(0), m1.vertices.mean(0)
    distal = c2 - c1
    distal[2] = 0
    distal /= np.linalg.norm(distal)
    width = np.ptp(m2.vertices @ distal)
    out = m2.copy()
    out.vertices = (out.vertices - c2) * 0.9 + c2
    if not lower:
        out.vertices += distal * width * 0.93
        return out
    # Fit crown contact, not root proximity: the lower second molars have
    # broad, tilted roots, which otherwise leave a visible gap at the bite.
    # Scaling around the cusp height keeps the erupted occlusal plane level.
    out.vertices[:, 2] += m2.vertices[:, 2].max() - out.vertices[:, 2].max()
    frame = make_frame(m2, np.array([0., 0., 1.]), -distal, np.array([np.sign(c2[0]), 0., 0.]))
    height = frame.to_local(m2.vertices)[:, 2]
    crown = height > height.max() - np.ptp(height) * 0.35 + 1.0
    tree = cKDTree(m2.vertices[crown])
    distance = width * 0.667
    while tree.query(out.vertices[crown] + distal * distance)[0].min() > 0.25:
        distance -= 0.02
        if distance < width * 0.35:
            raise ValueError("Could not fit mandibular third-molar crown contact")
    out.vertices += distal * distance
    return out


def carve_tooth_sockets(gum: trimesh.Trimesh, tooth_meshes: list[trimesh.Trimesh]) -> trimesh.Trimesh:
    """Remove tooth volumes from gingiva, with 0.08 mm clearance at contact."""
    cutters = []
    for tooth in tooth_meshes:
        cutter = tooth.copy()
        cutter.vertices = cutter.vertices + cutter.vertex_normals * 0.08
        cutters.append(cutter)
    carved = trimesh.boolean.difference([gum, *cutters], engine="manifold")
    if not carved.is_watertight:
        raise ValueError("Gingival socket subtraction produced an open mesh")
    # Boolean intersections can leave microscopic closed slivers. Keep the
    # anatomical body, which contains more than 99.99% of the result's volume.
    body = max(carved.split(), key=lambda part: part.volume)
    return orient_outward(body)


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
        teeth[q * 10 + 8] = derive_third_molar(
            teeth[q * 10 + 7], teeth[q * 10 + 6], lower=q in (3, 4)
        )

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
                     str(cache / f"layers-{'v8' if f in (38, 48) else 'v7'}-{f}.pkl")))
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
        add("core", f"tooth-{f}", decimate(m, 12000), prov, TEETH_FMA[f])
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
        gum = decimate(load_stl(args.bp3d, fma), 14000)
        upper = key == "gingiva-upper"
        arch_teeth = {f: m for f, m in teeth.items() if (f < 30) == upper}
        gum = expose_third_molar_crowns(gum, arch_teeth, frames, layers)
        fitted = carve_tooth_sockets(gum, list(arch_teeth.values()))
        add("core", key, fitted, "derived", fma)

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
    mand = decimate(load_stl(args.bp3d, BONES["mandible"]), 28000)
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
        mx = decimate(load_stl(args.bp3d, BONES[f"maxilla-{side}"]), 18000)
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
            temporal[key.split("-")[-1]] = decimate(m, 15000)
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

    # ---- neurovascular -------------------------------------------------------
    # Nerve and vessel centrelines come from Z-Anatomy (registered onto these
    # jaws by extract_z_anatomy.py). Structures Z-Anatomy does not model (the
    # superior alveolar nerves, the inferior alveolar vein and the pterygoid
    # plexus) are placed from landmarks and joined to those paths.
    print("Neurovascular paths…")
    za = json.loads((Path(__file__).parent / "data" / "z-anatomy-neurovascular.json").read_text())["structures"]
    # Neck vessels (z_splines(neck=True)) are clipped at the angle of the mandible (issue #26): below it they add clutter
    # and nothing a dental student needs. The level stays below the lowest point of the facial
    # vessels, so those are never cut where they loop under the lower border of the mandible.
    mand_v = load_stl(args.bp3d, BONES["mandible"]).vertices
    ramus = mand_v[mand_v[:, 1] > mand_v[:, 1].max() - 25]  # behind the molars
    facial_low = min(np.array(sp["points"])[:, 2].min() for n in ("Facial artery", "Facial vein")
                     for sd in ("right", "left") for sp in za[n][sd])
    z_clip = min(ramus[:, 2].min() - 3, facial_low - 1)
    print(f"  neck clip {z_clip:.1f} mm (angle of mandible {ramus[:, 2].min():.1f})")

    # "jaw weight" per vertex: 0 = moves with the mandible, 1 = moves with the skull and
    # maxillae when the arches separate. Vessels that run between the two stretch.
    upper_bones = trimesh.util.concatenate(
        [load_stl(args.bp3d, BONES["maxilla-right"]), load_stl(args.bp3d, BONES["maxilla-left"])]
        + [load_stl(args.bp3d, CONTEXT[k]) for k in ("temporal-bone-right", "temporal-bone-left", "sphenoid-bone",
                                                     "palatine-bone-right", "palatine-bone-left",
                                                     "zygomatic-bone-right", "zygomatic-bone-left")])
    mand_hi = load_stl(args.bp3d, BONES["mandible"])
    upper_kd = cKDTree(upper_bones.sample(120000, seed=np.random.default_rng(1)))
    mand_kd = cKDTree(mand_hi.sample(60000, seed=np.random.default_rng(2)))

    def jaw_weight(v: np.ndarray) -> np.ndarray:
        dl = mand_kd.query(v)[0]
        du = upper_kd.query(v)[0]
        w = dl / np.maximum(dl + du, 1e-6)
        w = ((w - 0.3) / 0.4).clip(0, 1)
        return w * w * (3 - 2 * w)

    # nerves in the walls of each maxillary sinus (the sinus is modelled to stay clear of them)
    sinus_nerves: dict[str, list[tuple[np.ndarray, np.ndarray]]] = {"right": [], "left": []}

    def z_splines(name, side, idx=None, scale=1.0, floor=0.3, neck=False):
        """Atlas splines of a structure; `neck` vessels are clipped at z_clip (below the angle)."""
        out = []
        for i, sp in enumerate(za[name][side]):
            if idx is not None and i not in idx:
                continue
            p = np.array(sp["points"])
            r = np.maximum(np.array(sp["radius"]) * 0.5 * scale, floor)
            run = longest_run(p[:, 2] >= z_clip) if neck else slice(0, len(p))
            if run is None:
                continue
            out.append((p[run], r[run]))
        return out

    sa_polys: dict[str, list[tuple[np.ndarray, np.ndarray]]] = {}

    def put(key, polys, provenance):
        polys = [(p, r) for p, r in polys if len(p) >= 2]
        if "superior-alveolar-nerve" in key:
            sa_polys[key] = polys
        parts, weights = [], []
        for p, r in polys:
            sides = 12 if r.max() > 0.6 else 8
            keep = np.r_[True, np.linalg.norm(np.diff(p, axis=0), axis=1) > 1e-6]
            # one weight per centreline point, smoothed along the path, shared by its whole ring,
            # so a tube never shears across its width when the jaws separate
            wp = jaw_weight(p[keep])
            if len(wp) > 4:
                wp = np.convolve(np.pad(wp, 2, mode="edge"), np.ones(5) / 5, mode="valid")
            parts.append(tube_polyline(p, r, sides=sides))
            weights.append(np.r_[np.repeat(wp, sides), wp[0], wp[-1]])
        m = trimesh.util.concatenate(parts)
        w = np.concatenate(weights)
        assert len(w) == len(m.vertices), key
        m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=np.c_[np.repeat((w * 255).round()[:, None], 3, 1), np.full(len(w), 255)].astype(np.uint8))
        add("neurovascular", key, m, provenance)
        manifest["paths"][key] = [S.p(p[:: max(1, len(p) // 24)]).round(4).tolist() for p, _ in polys]

    def longest_run(mask: np.ndarray):
        """Slice of the longest run of True (a path clipped at a plane stays one piece)."""
        best, start = None, None
        for i, m in enumerate(np.r_[mask, False]):
            if m and start is None:
                start = i
            elif not m and start is not None:
                if i - start >= 2 and (best is None or i - start > best.stop - best.start):
                    best = slice(start, i)
                start = None
        return best

    def smooth_path(pts, n=6):
        return catmull_rom(np.asarray(pts, float), n)

    def apex(f):
        return layers[f].landmarks["apex"] if f in layers else teeth[f].vertices[np.argmin(teeth[f].vertices[:, 2])]

    NERVE, ART, VEIN = 2.0, 1.0, 1.0  # Z-Anatomy radius factor → mm (its bevel is 0.5 mm)
    for side, q_lo, q_up, sgn in (("right", 4, 1, -1), ("left", 3, 2, 1)):
        # --- nerves -------------------------------------------------------
        # Z-Anatomy's trigeminal nerve is its sensory root back to the pons (spline 0, ending at the
        # ganglion) and the start of V3 down to the foramen ovale (spline 1). Only the ganglion is
        # kept, where V2 and V3 meet (issue #27: no nerve far outside the dental region); the V3
        # part joins the mandibular nerve.
        root, v3_top = z_splines("Trigeminal nerve (V)", side, scale=NERVE)
        ganglion = np.linalg.norm(root[0] - root[0][-1], axis=1) <= 8.0
        put(f"trigeminal-nerve-{side}", [(root[0][ganglion], root[1][ganglion])], "atlas")
        put(f"mandibular-nerve-{side}", [v3_top] + z_splines("Anterior division of mandibular nerve", side, scale=NERVE)
            + z_splines("Posterior division of mandibular nerve", side, scale=NERVE), "atlas")
        ian = za["Inferior alveolar nerve"][side]
        # Z-Anatomy's dental branches run on into its own (different) teeth: end each at the
        # apex of the nearest tooth here, and add a branch for any tooth left without one.
        lower_fdi = [q_lo * 10 + n for n in range(1, 9)]
        apices = np.array([apex(f) for f in lower_fdi])
        ian_polys = z_splines("Inferior alveolar nerve", side, idx={0} | set(range(2, len(ian))), scale=NERVE, floor=0.22)
        served = set()
        for i, (p, r) in enumerate(ian_polys):
            if i == 0 or p[-1][2] - p[0][2] < 5:  # dental branches rise toward the teeth
                continue
            d = np.linalg.norm(p[:, None] - apices[None], axis=2)
            k, j = np.unravel_index(d.argmin(), d.shape)
            ian_polys[i] = (np.vstack([p[: k + 1], apices[j]]), np.r_[r[: k + 1], r[k]])
            served.add(j)
        # The trunk at its real calibre (about 2.2 mm across), thicker than the artery and vein
        # beside it in the canal, so it reads as the main structure there (issue #27).
        ian_polys[0] = (ian_polys[0][0], np.clip(ian_polys[0][1] * 1.7, 0.9, 1.2))
        ian_trunk_pts = ian_polys[0][0]
        for j in set(range(8)) - served:
            k = int(np.argmin(np.linalg.norm(ian_trunk_pts - apices[j], axis=1)))
            b = smooth_path([ian_trunk_pts[k], (ian_trunk_pts[k] + apices[j]) / 2 + np.array([0, 0, 1.0]), apices[j]], 5)
            ian_polys.append((b, np.full(len(b), 0.25)))
        put(f"inferior-alveolar-nerve-{side}", ian_polys, "atlas")
        put(f"incisive-nerve-{side}", z_splines("Inferior alveolar nerve", side, idx={1}, scale=NERVE, floor=0.3), "atlas")
        put(f"mental-nerve-{side}", z_splines("Mental nerve", side, scale=NERVE, floor=0.25), "atlas")
        put(f"lingual-nerve-{side}", z_splines("Lingual nerve", side, scale=NERVE), "atlas")
        put(f"buccal-nerve-{side}", z_splines("Buccal nerve", side, scale=NERVE, floor=0.25), "atlas")

        # V2: the maxillary nerve runs to the pterygopalatine fossa, then continues as the
        # infraorbital nerve along the orbital floor and out of the infraorbital foramen.
        mxn = z_splines("Maxillary nerve", side, scale=NERVE, floor=0.25)
        trunk, trunk_r = mxn[0]
        mx_side = load_stl(args.bp3d, BONES[f"maxilla-{side}"])
        near = cKDTree(mx_side.sample(30000, seed=np.random.default_rng(3))).query(trunk)[0]
        k_io = int(np.argmax(near < 3.0))  # first point within 3 mm of the maxilla: the fossa / orbital floor
        put(f"maxillary-nerve-{side}", [(trunk[: k_io + 1], trunk_r[: k_io + 1])], "atlas")
        io_trunk = trunk[k_io:]
        put(f"infraorbital-nerve-{side}", [(io_trunk, trunk_r[k_io:])] + mxn[1:], "atlas")
        sinus_nerves[side].append((io_trunk, trunk_r[k_io:]))
        tang = np.gradient(io_trunk, axis=0)
        tang /= np.linalg.norm(tang, axis=1, keepdims=True)
        k_f = int(np.argmax(tang[:, 2] < -0.6))  # where the nerve turns down out of the foramen
        io_f = io_trunk[k_f]
        manifest["landmarks"][f"infraorbital-foramen-{side}"] = S.p(io_f).round(4).tolist()

        # superior alveolar nerves (schematic, joined to V2 / the infraorbital nerve)
        ap_ = {n: apex(q_up * 10 + n) for n in range(1, 9)}
        upz = np.array([0, 0, 3.0])
        t8 = teeth[q_up * 10 + 8].vertices
        tub = np.array([ap_[8][0] + sgn * 3, t8[:, 1].max() + 4, ap_[8][2] + 10])
        psa_start = trunk[k_io]
        put(f"posterior-superior-alveolar-nerve-{side}",
            [(p := smooth_path([psa_start, tub, ap_[8] + upz + np.array([sgn * 1.5, 0, 0]), ap_[7] + upz, ap_[6] + upz]), np.linspace(0.55, 0.35, len(p)))],
            "schematic")
        k_mid = k_io + max(1, k_f // 2)
        msa_start = trunk[min(k_mid, len(trunk) - 1)]
        put(f"middle-superior-alveolar-nerve-{side}",
            [(p := smooth_path([msa_start, ap_[5] + upz * 2.2, ap_[5] + upz, ap_[4] + upz]), np.linspace(0.45, 0.32, len(p)))], "schematic")
        asa_start = io_trunk[max(0, k_f - 3)]
        put(f"anterior-superior-alveolar-nerve-{side}",
            [(p := smooth_path([asa_start, ap_[3] + upz * 2.5, ap_[3] + upz, ap_[2] + upz, ap_[1] + upz + np.array([-sgn * 1.5, 0, 0])]), np.linspace(0.5, 0.32, len(p)))],
            "schematic")

        sinus_nerves[side] += [(p, r) for k in ("posterior", "middle", "anterior")
                               for p, r in sa_polys[f"{k}-superior-alveolar-nerve-{side}"]]

        # landmarks on the mandible from the alveolar nerve itself
        ian_trunk = np.array(ian[0]["points"])
        inside = mand_hi.contains(ian_trunk)
        foramen = ian_trunk[int(np.argmax(inside))]
        manifest["landmarks"][f"mandibular-foramen-{side}"] = S.p(foramen).round(4).tolist()
        mn0 = np.array(za["Mental nerve"][side][0]["points"])[0]
        mental_f = mand_hi.nearest.on_surface([mn0])[0][0]
        manifest["landmarks"][f"mental-foramen-{side}"] = S.p(mental_f).round(4).tolist()

        # --- arteries -----------------------------------------------------
        put(f"external-carotid-artery-{side}", z_splines("External carotid artery", side, scale=ART, neck=True), "atlas")
        put(f"maxillary-artery-{side}", z_splines("Maxillary artery", side, scale=ART, floor=0.25), "atlas")
        iaa = z_splines("Inferior alveolar artery", side, scale=ART, floor=0.3) + z_splines(
            "Mental branch of inferior alveolar artery", side, scale=ART, floor=0.25)
        put(f"inferior-alveolar-artery-{side}", iaa, "atlas")
        put(f"posterior-superior-alveolar-artery-{side}", z_splines("Posterior superior alveolar artery", side, scale=ART, floor=0.3), "atlas")
        put(f"descending-palatine-artery-{side}", z_splines("Descending palatine artery", side, scale=ART)
            + z_splines("Greater palatine artery", side, scale=ART), "atlas")
        put(f"buccal-artery-{side}", z_splines("Buccal artery", side, scale=ART * 0.5), "atlas")
        put(f"facial-artery-{side}", z_splines("Facial artery", side, scale=ART, neck=True), "atlas")

        # --- veins ----------------------------------------------------------
        # The external jugular vein and the posterior division of the retromandibular vein that forms
        # it drain the scalp, not the jaws: left out (issue #26). The dental chain ends in the
        # internal jugular vein through the anterior division and the common facial vein.
        put(f"internal-jugular-vein-{side}", z_splines("Internal jugular vein", side, scale=VEIN * 0.8, neck=True), "atlas")
        put(f"retromandibular-vein-{side}", z_splines("Retromandibular vein", side, scale=VEIN, neck=True)
            + z_splines("Anterior division of retromandibular vein", side, scale=VEIN, neck=True), "atlas")
        mxv = z_splines("Maxillary veins", side, scale=VEIN)
        put(f"maxillary-vein-{side}", mxv, "atlas")
        put(f"facial-vein-{side}", z_splines("Facial vein", side, scale=VEIN, neck=True) + z_splines("Common facial vein", side, scale=VEIN, neck=True), "atlas")

        # Pterygoid plexus (schematic): a small venous network on the lateral pterygoid,
        # draining into the maxillary vein. The mesh is a set of interlinked vessels.
        lp = trimesh.util.concatenate([load_stl(args.bp3d, CONTEXT[f"lateral-pterygoid-lower-{side}"]),
                                       load_stl(args.bp3d, CONTEXT[f"lateral-pterygoid-upper-{side}"])])
        mv_pts = np.vstack([p for p, _ in mxv])
        # the maxillary vein end that lies nearest the muscle is where the plexus drains
        ends = np.array([mv_pts[0], mv_pts[-1]])
        drain = ends[np.argmin(np.linalg.norm(ends - lp.centroid, axis=1))]
        lat = lp.vertices[(lp.vertices[:, 0] - lp.centroid[0]) * sgn > 0]  # lateral surface points
        lo_, hi_ = lat.min(0), lat.max(0)
        grid = []
        for zi in np.linspace(0.2, 0.8, 3):
            row = []
            for yi in np.linspace(0.15, 0.85, 4):
                target = np.array([0, lo_[1] + (hi_[1] - lo_[1]) * yi, lo_[2] + (hi_[2] - lo_[2]) * zi])
                cand = lat[np.argmin(np.linalg.norm((lat - target)[:, 1:], axis=1))]
                row.append(cand + np.array([sgn * 1.5, 0, 0]))
            grid.append(row)
        grid = np.array(grid)
        plexus = []
        for row in grid:
            plexus.append(smooth_path(row, 5))
        for j in range(grid.shape[1]):
            plexus.append(smooth_path(grid[:, j], 5))
        plexus.append(smooth_path([grid[1, 1], (grid[1, 1] + drain) / 2 + np.array([sgn * 1.0, 0, 0]), drain], 5))
        put(f"pterygoid-plexus-{side}", [(p, np.full(len(p), 0.55)) for p in plexus], "schematic")

        # Inferior alveolar vein (schematic): runs with the artery in the canal and joins the plexus.
        ia_pts = np.vstack([p for p, _ in z_splines("Inferior alveolar artery", side)])
        if np.linalg.norm(ia_pts[0] - drain) > np.linalg.norm(ia_pts[-1] - drain):
            ia_pts = ia_pts[::-1]  # from the plexus down to the mental foramen
        mid_row = grid[:, 1]
        start = mid_row[np.argmin(mid_row[:, 2])]  # lowest plexus vessel
        offs = np.array([sgn * 0.5, 0.3, -0.9])
        path = np.vstack([start, ia_pts[len(ia_pts) // 6:] + offs])
        path = path[::max(1, len(path) // 18)]
        put(f"inferior-alveolar-vein-{side}", [(p := smooth_path(path, 4), np.linspace(0.55, 0.35, len(p)))], "schematic")

    # ---- maxillary sinus (modelled; see sinus.py) ------------------------------
    print("Maxillary sinuses…")
    manifest["sinus"] = {}
    for side, q_up in (("right", 1), ("left", 2)):
        concha = load_stl(args.bp3d, CONTEXT[f"inferior-nasal-concha-{side}"]).vertices[:, 0]
        nasal_wall_x = concha.min() if side == "right" else concha.max()  # its lateral edge
        up = {f: teeth[f] for f in teeth if f // 10 == q_up}
        res = build_sinus(load_stl(args.bp3d, BONES[f"maxilla-{side}"]), up, {f: apex(f) for f in up},
                          sinus_nerves[side], nasal_wall_x)
        add("core", f"maxillary-sinus-{side}", res.mesh, "modeled", BONES[f"maxilla-{side}"])
        manifest["sinus"][side] = {"volume": res.volume_cm3, "apexGap": {str(k): v for k, v in res.apex_gap.items()}}
        print(f"  {side}: {res.volume_cm3} cm³, apex → floor (mm): {res.apex_gap}")

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

    from cranial import extend_cranial
    context_geometry = dict(scenes["core"].geometry)
    context_geometry.update(scenes["context"].geometry)
    extend_cranial(scenes["neurovascular"], context_geometry, manifest, S, {"structures": za})
    manifest["explode"] = explode_plan(scenes["core"].geometry, manifest["teeth"])

    for name, sc in scenes.items():
        sc.export(out / f"{name}.glb")
    manifest["bounds"] = S.p(np.array([lo, hi])).round(4).tolist()
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print("Done.", {k: len(v.geometry) for k, v in scenes.items()}, "teeth assets:", len(layers))


def explode_plan(core: dict, teeth_info: dict, gap: float = 0.3, bite_gap: float = 0.6) -> dict:
    """Separations (cm) for the arch dissection: bone | gingiva | teeth tiers.

    The gingiva moves straight toward the bite until it clears the bone in every vertical
    column (a height field over x/z). Each tooth then slides out of its socket along its
    own long axis, just far enough to clear the gum: a tilted root pulled straight up
    would cut through the socket wall, along its axis it follows the socket. Finally the
    jaws open until the extracted upper and lower teeth clear each other.
    Writes each tooth's extraction distance to teeth_info[fdi]["extract"].
    """
    rng = np.random.default_rng(4)

    def pts(keys):
        m = trimesh.util.concatenate([core[k] for k in keys])
        return np.vstack([m.sample(40000, seed=rng), m.vertices])

    def clearance(moving, fixed, up: bool, cell=0.08) -> float:
        cm = [tuple(c) for c in np.floor(moving[:, [0, 2]] / cell).astype(int)]
        cf = [tuple(c) for c in np.floor(fixed[:, [0, 2]] / cell).astype(int)]
        lo_m, hi_f = {}, {}
        for c, y in zip(cm, moving[:, 1] if up else -moving[:, 1]):
            lo_m[c] = min(lo_m.get(c, np.inf), y)
        for c, y in zip(cf, fixed[:, 1] if up else -fixed[:, 1]):
            hi_f[c] = max(hi_f.get(c, -np.inf), y)
        d = [hi_f[c] - lo_m[c] for c in lo_m if c in hi_f]
        return float(max(0.0, max(d))) if d else 0.0

    bone_u = pts(["maxilla-right", "maxilla-left", "maxillary-alveolar-process-right", "maxillary-alveolar-process-left"])
    bone_l = pts(["mandible-body", "mandibular-alveolar-process"])
    g_u = clearance(pts(["gingiva-upper"]), bone_u, up=False) + gap
    g_l = clearance(pts(["gingiva-lower"]), bone_l, up=True) + gap

    moved = {"upper": [], "lower": []}
    for f, info in teeth_info.items():
        fdi = int(f)
        shell = core[f"tooth-{fdi}"]
        gum = core["gingiva-upper" if fdi < 30 else "gingiva-lower"]
        axis = np.array(info["frame"]["axis"], float)
        axis /= np.linalg.norm(axis)
        v = shell.vertices
        c = v.mean(0)
        radial = lambda p: np.linalg.norm(np.cross(p - c, axis), axis=1)  # noqa: E731
        # the gum within the tooth's footprint around its axis; the tooth has to pass all of it
        near = gum.vertices[radial(gum.vertices) < radial(v).max() + 0.1]
        dist = max(0.0, float((near @ axis).max() - (v @ axis).min())) if len(near) else 0.0
        info["extract"] = round(dist + gap, 3)
        # highest gum point over the tooth, along its axis from the cervical line: while the tooth
        # slides out, the engine hides the part of it still below this collar (inside the gum)
        cervical = np.array(info["landmarks"]["cervical-line"])
        info["collar"] = round(float((near @ axis).max() - cervical @ axis) + 0.02, 3) if len(near) else 0.0
        jaw_shift = np.array([0, -g_u, 0]) if fdi < 30 else np.array([0, g_l, 0])
        moved["upper" if fdi < 30 else "lower"].append(shell.vertices + jaw_shift + axis * info["extract"])
    up = np.vstack(moved["upper"])
    lo = np.vstack(moved["lower"])
    jaw = (clearance(up, lo, up=True) + bite_gap) / 2
    t_u = max(float(teeth_info[k]["extract"]) for k in teeth_info if int(k) < 30)
    t_l = max(float(teeth_info[k]["extract"]) for k in teeth_info if int(k) > 30)
    plan = {"jaw": round(jaw, 3), "upper": {"gingiva": round(g_u, 3), "teeth": round(g_u + t_u, 3)},
            "lower": {"gingiva": round(g_l, 3), "teeth": round(g_l + t_l, 3)}}
    print("Explode plan:", plan)
    return plan

if __name__ == "__main__":
    main()
