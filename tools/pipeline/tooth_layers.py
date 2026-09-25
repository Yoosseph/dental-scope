"""
Tooth layer modelling for Dental Scope.

Takes one closed external tooth surface (BodyParts3D) and derives schematic
internal anatomy as separate closed solids:

    enamel, coronal dentin, radicular dentin, cementum, periodontal ligament,
    pulp chamber, one tube per root canal

Method
------
1. Build a local frame: long axis (PCA, oriented toward the crown), mesial and
   buccal directions supplied by the caller (from the arch layout).
2. Voxelise the tooth in that frame and compute a signed distance field (EDT).
3. Place the cervical line using a typical crown/total length ratio for the
   tooth type, curved toward the crown on proximal surfaces.
4. Every tissue is a scalar field whose zero level set is its surface:
       enamel   = inside ∧ depth < e(h) ∧ above cervical line
       dentin   = inside ∧ depth > outer layer ∧ outside pulp
       cementum = inside ∧ depth < c(h) ∧ below cervical line
       PDL      = thin shell just outside the root below the alveolar crest
       pulp     = (depth > w(h) above chamber floor) ∪ canal tubes
   Canals follow each root's medial axis, found by tracking connected
   components of cross-sections from the furcation to the apex.
5. Marching cubes → Taubin smoothing → quadric decimation.

Thickness parameters are *modelling* parameters chosen to give a readable
schematic at screen scale; they are not measurements. The UI labels these
structures as `modeled`.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import trimesh
from scipy import ndimage
from skimage import measure

try:
    import fast_simplification
except ImportError:  # pragma: no cover
    fast_simplification = None


# --------------------------------------------------------------------------
# Per-type modelling parameters
# crown_ratio : typical anatomical crown length / total tooth length
# cej_curve   : how far (mm) the cervical line curves crownward on proximal faces
# enamel      : (axial wall, cusp/incisal) max enamel thickness in mm
# canals      : list of (root position label, canal count) in expected order
# --------------------------------------------------------------------------
TYPE_PARAMS = {
    ("maxillary", "central-incisor"): dict(crown_ratio=0.45, cej_curve=2.5, enamel=(0.9, 1.3)),
    ("maxillary", "lateral-incisor"): dict(crown_ratio=0.41, cej_curve=2.3, enamel=(0.8, 1.2)),
    ("maxillary", "canine"): dict(crown_ratio=0.37, cej_curve=2.0, enamel=(1.0, 1.6)),
    ("maxillary", "first-premolar"): dict(crown_ratio=0.38, cej_curve=1.0, enamel=(1.1, 1.8)),
    ("maxillary", "second-premolar"): dict(crown_ratio=0.38, cej_curve=1.0, enamel=(1.1, 1.8)),
    ("maxillary", "first-molar"): dict(crown_ratio=0.37, cej_curve=0.6, enamel=(1.2, 2.2)),
    ("maxillary", "second-molar"): dict(crown_ratio=0.38, cej_curve=0.5, enamel=(1.2, 2.1)),
    ("maxillary", "third-molar"): dict(crown_ratio=0.39, cej_curve=0.5, enamel=(1.2, 2.0)),
    ("mandibular", "central-incisor"): dict(crown_ratio=0.42, cej_curve=2.2, enamel=(0.7, 1.0)),
    ("mandibular", "lateral-incisor"): dict(crown_ratio=0.40, cej_curve=2.2, enamel=(0.7, 1.0)),
    ("mandibular", "canine"): dict(crown_ratio=0.41, cej_curve=1.8, enamel=(1.0, 1.5)),
    ("mandibular", "first-premolar"): dict(crown_ratio=0.38, cej_curve=0.9, enamel=(1.0, 1.7)),
    ("mandibular", "second-premolar"): dict(crown_ratio=0.36, cej_curve=0.9, enamel=(1.0, 1.7)),
    ("mandibular", "first-molar"): dict(crown_ratio=0.35, cej_curve=0.5, enamel=(1.2, 2.2)),
    ("mandibular", "second-molar"): dict(crown_ratio=0.35, cej_curve=0.5, enamel=(1.2, 2.1)),
    ("mandibular", "third-molar"): dict(crown_ratio=0.38, cej_curve=0.5, enamel=(1.2, 2.0)),
}

# Typical canal configuration per root (textbook "most common" case).
# Keys are root position labels resolved from geometry; a single-rooted tooth
# uses "single".
CANALS = {
    ("maxillary", "central-incisor"): {"single": 1},
    ("maxillary", "lateral-incisor"): {"single": 1},
    ("maxillary", "canine"): {"single": 1},
    ("maxillary", "first-premolar"): {"buccal": 1, "palatal": 1, "single": 2},
    ("maxillary", "second-premolar"): {"single": 1},
    ("maxillary", "first-molar"): {"mesiobuccal": 2, "distobuccal": 1, "palatal": 1},
    ("maxillary", "second-molar"): {"mesiobuccal": 1, "distobuccal": 1, "palatal": 1},
    ("maxillary", "third-molar"): {"mesiobuccal": 1, "distobuccal": 1, "palatal": 1},
    ("mandibular", "central-incisor"): {"single": 1},
    ("mandibular", "lateral-incisor"): {"single": 1},
    ("mandibular", "canine"): {"single": 1},
    ("mandibular", "first-premolar"): {"single": 1},
    ("mandibular", "second-premolar"): {"single": 1},
    ("mandibular", "first-molar"): {"mesial": 2, "distal": 1},
    ("mandibular", "second-molar"): {"mesial": 2, "distal": 1},
    ("mandibular", "third-molar"): {"mesial": 1, "distal": 1},
}

# Expected root layout used when geometry shows fused roots.
EXPECTED_ROOTS = {
    ("maxillary", "first-premolar"): ["buccal", "palatal"],
    ("maxillary", "first-molar"): ["mesiobuccal", "distobuccal", "palatal"],
    ("maxillary", "second-molar"): ["mesiobuccal", "distobuccal", "palatal"],
    ("maxillary", "third-molar"): ["mesiobuccal", "distobuccal", "palatal"],
    ("mandibular", "first-molar"): ["mesial", "distal"],
    ("mandibular", "second-molar"): ["mesial", "distal"],
    ("mandibular", "third-molar"): ["mesial", "distal"],
}

ROOT_DIRS = {  # unit direction in (mesial, buccal) plane
    "mesial": (1, 0), "distal": (-1, 0), "buccal": (0, 1), "palatal": (0, -1), "lingual": (0, -1),
    "mesiobuccal": (0.75, 0.66), "distobuccal": (-0.75, 0.66),
}


@dataclass
class Frame:
    origin: np.ndarray  # world point
    axis: np.ndarray    # long axis toward crown
    mesial: np.ndarray
    buccal: np.ndarray

    @property
    def R(self) -> np.ndarray:
        # rows = local basis (x=mesial, y=buccal, z=axis)
        return np.stack([self.mesial, self.buccal, self.axis])

    def to_local(self, p):
        return (p - self.origin) @ self.R.T

    def to_world(self, p):
        return p @ self.R + self.origin


@dataclass
class ToothLayers:
    meshes: dict = field(default_factory=dict)       # name -> trimesh.Trimesh (world)
    landmarks: dict = field(default_factory=dict)    # name -> world point
    roots: list = field(default_factory=list)        # [{label, canals:[names]}]
    cej_height: float = 0.0
    frame: Frame | None = None


def make_frame(mesh: trimesh.Trimesh, crown_dir: np.ndarray, mesial_hint: np.ndarray, buccal_hint: np.ndarray) -> Frame:
    v = mesh.vertices
    c = v.mean(0)
    cov = (v - c).T @ (v - c)
    w, vec = np.linalg.eigh(cov)
    axis = vec[:, 2]
    if axis @ crown_dir < 0:
        axis = -axis
    # Blend PCA axis with the jaw's crown direction; PCA alone is unstable for
    # wide molars.
    axis = axis * 0.7 + crown_dir * 0.3
    axis /= np.linalg.norm(axis)
    m = mesial_hint - axis * (mesial_hint @ axis)
    m /= np.linalg.norm(m)
    b = np.cross(axis, m)
    if b @ buccal_hint < 0:
        b = -b
    return Frame(origin=c, axis=axis, mesial=m, buccal=b)


def voxelize_parity(tri: np.ndarray, lo: np.ndarray, h: float, shape) -> np.ndarray:
    """Inside/outside by ray parity along +z for each (x, y) column."""
    nx, ny, nz = shape
    crossings = [[[] for _ in range(ny)] for _ in range(nx)]
    xs = lo[0] + (np.arange(nx) + 0.5) * h
    ys = lo[1] + (np.arange(ny) + 0.5) * h
    for t in tri:
        a, b, c = t
        minx, maxx = min(a[0], b[0], c[0]), max(a[0], b[0], c[0])
        miny, maxy = min(a[1], b[1], c[1]), max(a[1], b[1], c[1])
        i0 = max(int(np.ceil((minx - lo[0]) / h - 0.5)), 0)
        i1 = min(int(np.floor((maxx - lo[0]) / h - 0.5)), nx - 1)
        j0 = max(int(np.ceil((miny - lo[1]) / h - 0.5)), 0)
        j1 = min(int(np.floor((maxy - lo[1]) / h - 0.5)), ny - 1)
        if i0 > i1 or j0 > j1:
            continue
        d = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
        if abs(d) < 1e-12:
            continue
        X, Y = np.meshgrid(xs[i0:i1 + 1], ys[j0:j1 + 1], indexing="ij")
        l1 = ((X - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (Y - a[1])) / d
        l2 = ((b[0] - a[0]) * (Y - a[1]) - (X - a[0]) * (b[1] - a[1])) / d
        l0 = 1 - l1 - l2
        ok = (l0 >= 0) & (l1 >= 0) & (l2 >= 0)
        if not ok.any():
            continue
        Z = l0 * a[2] + l1 * b[2] + l2 * c[2]
        for (ii, jj) in zip(*np.nonzero(ok)):
            crossings[i0 + ii][j0 + jj].append(Z[ii, jj])
    inside = np.zeros(shape, bool)
    zs = lo[2] + (np.arange(nz) + 0.5) * h
    for i in range(nx):
        for j in range(ny):
            cz = crossings[i][j]
            if len(cz) < 2:
                continue
            cz = np.sort(cz)
            # remove near-duplicates from shared edges
            keep = np.concatenate([[True], np.diff(cz) > 1e-6])
            cz = cz[keep]
            for k in range(0, len(cz) - 1, 2):
                inside[i, j, (zs > cz[k]) & (zs < cz[k + 1])] = True
    return inside


def smin(a, b, k):
    """Polynomial smooth minimum (k in field units)."""
    hh = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - hh) + a * hh - k * hh * (1 - hh)


def smax(a, b, k):
    return -smin(-a, -b, k)


def surface(field: np.ndarray, lo, h, frame: Frame, target_faces: int, smooth=6) -> trimesh.Trimesh | None:
    if field.max() <= 0:
        return None
    padded = np.pad(field, 1, constant_values=-1.0)
    verts, faces, _, _ = measure.marching_cubes(padded, level=0.0, spacing=(h, h, h))
    verts = verts - h + lo
    # marching_cubes on a positive-inside field gives inward normals; flip.
    faces = faces[:, ::-1]
    m = trimesh.Trimesh(verts, faces, process=True)
    # drop tiny islands
    parts = m.split(only_watertight=False)
    if len(parts) > 1:
        big = max(p.area for p in parts)
        m = trimesh.util.concatenate([p for p in parts if p.area > big * 0.02])
    trimesh.smoothing.filter_taubin(m, iterations=smooth)
    if fast_simplification is not None and len(m.faces) > target_faces:
        v2, f2 = fast_simplification.simplify(m.vertices.astype(np.float32), m.faces.astype(np.int32),
                                              target_reduction=1 - target_faces / len(m.faces))
        m = trimesh.Trimesh(v2, f2, process=True)
    m.vertices = frame.to_world(np.asarray(m.vertices))
    m.fix_normals()
    return m


def track_roots(inside, lo, h, z_top, z_bottom):
    """Connected components of cross-sections from z_top down to z_bottom.
    Returns list of roots: dict(label_xy=[...], path=[(x,y,z)], area=[...])"""
    nz = inside.shape[2]
    zs = lo[2] + (np.arange(nz) + 0.5) * h
    ks = [k for k in range(nz) if z_bottom <= zs[k] <= z_top][::-1]
    roots = []
    for k in ks:
        lab, n = ndimage.label(inside[:, :, k])
        comps = []
        for ci in range(1, n + 1):
            ij = np.argwhere(lab == ci)
            if len(ij) < 6:
                continue
            xy = lo[:2] + (ij + 0.5) * h
            comps.append((xy.mean(0), len(ij) * h * h, xy))
        for cxy, area, pts in comps:
            # attach to nearest active root
            best, bd = None, 1e9
            for r in roots:
                if r["last_k"] - k > 3:
                    continue
                d = np.linalg.norm(r["path"][-1][:2] - cxy)
                if d < bd:
                    best, bd = r, d
            if best is not None and bd < 2.2 and best["last_k"] != k:
                best["path"].append(np.array([cxy[0], cxy[1], zs[k]]))
                best["area"].append(area)
                best["pts"].append(pts)
                best["last_k"] = k
            else:
                roots.append(dict(path=[np.array([cxy[0], cxy[1], zs[k]])], area=[area], pts=[pts], last_k=k))
    roots = [r for r in roots if len(r["path"]) >= 8]
    return roots


def build_tooth_layers(mesh: trimesh.Trimesh, arch: str, ttype: str, frame: Frame, h=0.11,
                       faces_budget=None) -> ToothLayers:
    key = (arch, ttype)
    P = TYPE_PARAMS[key]
    faces_budget = faces_budget or dict(enamel=7000, dentin=6000, cementum=4000, pdl=3000, chamber=2500, canal=900)

    tri_local = frame.to_local(mesh.vertices)[mesh.faces]
    vl = tri_local.reshape(-1, 3)
    pad = 1.2
    lo = vl.min(0) - pad
    hi = vl.max(0) + pad
    shape = tuple(np.ceil((hi - lo) / h).astype(int))
    inside = voxelize_parity(tri_local, lo, h, shape)
    inside = ndimage.binary_closing(inside, iterations=1)

    din = ndimage.distance_transform_edt(inside) * h
    dout = ndimage.distance_transform_edt(~inside) * h
    sd = np.where(inside, din - 0.5 * h, -(dout - 0.5 * h))  # + inside

    X = lo[0] + (np.arange(shape[0]) + 0.5) * h
    Y = lo[1] + (np.arange(shape[1]) + 0.5) * h
    Z = lo[2] + (np.arange(shape[2]) + 0.5) * h
    XX, YY, ZZ = np.meshgrid(X, Y, Z, indexing="ij")

    z_top = vl[:, 2].max()
    z_apex = vl[:, 2].min()
    H = z_top - z_apex
    crown_len = P["crown_ratio"] * H
    z_cej = z_top - crown_len
    # cervical line curves crownward on the proximal (mesial/distal) surfaces
    r_xy = np.sqrt(XX ** 2 + YY ** 2) + 1e-6
    prox = (XX / r_xy) ** 2
    cej = z_cej + P["cej_curve"] * prox
    hc = ZZ - cej  # height above the cervical line (mm)

    # ---- enamel ------------------------------------------------------------
    e_ax, e_tip = P["enamel"]
    up = np.clip(hc / max(crown_len, 1e-3), 0, 1)
    e = (np.clip(hc / 1.8, 0, 1) ** 0.8) * (e_ax + (e_tip - e_ax) * np.clip((up - 0.55) / 0.45, 0, 1))
    # keep a minimum (slightly exaggerated) thickness so the enamel margin meets the
    # cementum cleanly at the cervical line instead of breaking up below voxel size
    e = np.maximum(e, 0.3)
    f_enamel = np.minimum.reduce([sd, e - sd, hc])

    # ---- pulp chamber -----------------------------------------------------
    multi = key in EXPECTED_ROOTS
    root_len = H - crown_len
    floor = -0.18 * root_len if multi else -0.05 * root_len
    half = np.percentile(np.abs(vl[np.abs(vl[:, 2] - z_cej) < 0.6][:, :2]), 90, axis=0).min()
    # dentin wall at the cervix ~ 60 % of the smaller half-width, thicker toward the roof
    wall = 0.6 * half
    # the wall thickens toward the occlusal surface; because `sd` is the distance to the
    # outer surface, the roof of the chamber follows the cusps and forms pulp horns
    roof_depth = wall + (0.9 if multi else 0.5)
    t = np.clip((hc / max(crown_len, 1e-3) - 0.1) / 0.45, 0, 1)
    w = wall + (roof_depth - wall) * t * t * (3 - 2 * t)
    f_chamber = smin(sd - w, (ZZ - (z_cej + floor)) * 1.0, 1.2)

    # ---- canals ----------------------------------------------------------
    z_furc = z_cej + floor - 0.3
    roots = track_roots(inside, lo, h, z_furc, z_apex + 0.2)
    labels = CANALS[key]
    expected = EXPECTED_ROOTS.get(key)
    canal_paths = []  # (name, rootLabel, [points local])
    root_infos = []

    def label_for(dirxy):
        cands = expected if expected else ["single"]
        if len(cands) == 1:
            return cands[0]
        best = max(cands, key=lambda c: np.dot(dirxy, ROOT_DIRS[c]))
        return best

    if roots:
        centre = np.mean([r["path"][0][:2] for r in roots], axis=0)
    used = set()
    root_specs = []
    if expected and len(roots) >= len(expected):
        # choose the largest len(expected) roots
        roots = sorted(roots, key=lambda r: -len(r["path"]))[: len(expected)]
        for r in roots:
            d = r["path"][0][:2] - centre
            d = d / (np.linalg.norm(d) + 1e-9)
            lab = label_for(d)
            if lab in used:
                lab = [c for c in expected if c not in used][0]
            used.add(lab)
            root_specs.append((lab, r))
    elif roots:
        # fused / single root: one geometric root carries all expected canals
        r = max(roots, key=lambda r: len(r["path"]))
        if expected:
            for lab in expected:
                root_specs.append((lab, dict(r, virtual=True, dir=np.array(ROOT_DIRS[lab], float))))
        else:
            root_specs.append(("single", r))

    for lab, r in root_specs:
        path = np.array(r["path"])
        # smooth path
        if len(path) > 5:
            path[:, 0] = ndimage.gaussian_filter1d(path[:, 0], 2.5, mode="nearest")
            path[:, 1] = ndimage.gaussian_filter1d(path[:, 1], 2.5, mode="nearest")
        if r.get("virtual"):
            path = path.copy()
            t = np.linspace(0, 1, len(path))[:, None]
            path[:, :2] += r["dir"][None, :] * (1.2 * (1 - 0.6 * t))
        n = labels.get(lab, 1)
        names = []
        if n == 1:
            pts = [path]
        else:
            # split along the cross-section's major axis
            allp = np.concatenate(r["pts"][: max(3, len(r["pts"]) // 2)])
            cov = np.cov((allp - allp.mean(0)).T)
            ev, evec = np.linalg.eigh(cov)
            major = evec[:, 1]
            spread = np.sqrt(ev[1]) * 1.0
            t = np.linspace(0, 1, len(path))[:, None]
            off = np.concatenate([major, [0]])[None, :] * spread * (1 - 0.35 * t)
            pts = [path + off, path - off]
        for ci, pth in enumerate(pts):
            # start the canal inside the chamber, end just through the apex
            top = pth[0].copy()
            top[2] = z_cej + floor + 1.2
            ext = pth[-1] + (pth[-1] - pth[-4]) / max(np.linalg.norm(pth[-1] - pth[-4]), 1e-6) * 0.9
            full = np.vstack([top, pth, ext])
            suffix = "" if n == 1 else ("-1", "-2")[ci]
            canal_name = f"canal-{lab}{suffix}"
            names.append(canal_name)
            canal_paths.append((canal_name, lab, full))
        root_infos.append(dict(label=lab, canals=names))

    def tube_field(path, r0=0.42, r1=0.14):
        # distance from grid points to polyline, sampled radius along path
        seg_len = np.linalg.norm(np.diff(path, axis=0), axis=1)
        s = np.concatenate([[0], np.cumsum(seg_len)])
        s /= s[-1]
        best = np.full(ZZ.shape, 1e9)
        rad = np.full(ZZ.shape, r1)
        P3 = np.stack([XX, YY, ZZ], -1)
        for i in range(len(path) - 1):
            a, b = path[i], path[i + 1]
            ab = b - a
            L2 = ab @ ab
            if L2 < 1e-12:
                continue
            t = np.clip(((P3 - a) @ ab) / L2, 0, 1)
            d = np.linalg.norm(P3 - (a + t[..., None] * ab), axis=-1)
            m = d < best
            best = np.where(m, d, best)
            ss = s[i] + t * (s[i + 1] - s[i])
            rad = np.where(m, r0 + (r1 - r0) * ss, rad)
        return rad - best

    # subsample paths for speed
    canal_fields = []
    for name, lab, pth in canal_paths:
        step = max(1, len(pth) // 14)
        sp = np.vstack([pth[::step], pth[-1:]])
        canal_fields.append((name, lab, tube_field(sp)))

    f_pulp_canals = np.max([cf for _, _, cf in canal_fields], axis=0) if canal_fields else np.full(ZZ.shape, -1.0)
    f_pulp = smax(f_chamber, f_pulp_canals, 0.35)
    f_pulp = np.minimum(f_pulp, sd + 0.02)  # stays within tooth, exits at foramen

    # ---- cementum / dentin / pdl -----------------------------------------
    below = -hc
    depth_frac = np.clip(below / max(root_len, 1e-3), 0, 1)
    c = 0.22 + 0.35 * depth_frac
    # Adjacent tissues are separated by a hair-thin gap (EPS). Coincident surfaces
    # would z-fight when a section exposes them; with the gap, the inner tissue's
    # cut face always wins and sections read as clean coloured bands.
    EPS = 0.1
    f_cementum = np.minimum.reduce([sd, c - sd, below, -f_pulp - EPS])
    outer = np.where(hc > 0, e, c)
    f_dentin = np.minimum(sd - outer - EPS, -f_pulp - EPS)
    f_dentin_cor = np.minimum(f_dentin, hc)
    f_dentin_rad = np.minimum(f_dentin, below - EPS * 0.5)
    crest = 1.6
    f_pdl = np.minimum.reduce([-sd - EPS, 0.28 + sd, below - crest])

    L = ToothLayers(frame=frame)
    fb = faces_budget
    for name, fld, budget in [
        ("enamel", f_enamel, fb["enamel"]),
        ("dentin-coronal", f_dentin_cor, fb["dentin"]),
        ("dentin-radicular", f_dentin_rad, fb["dentin"]),
        ("cementum", f_cementum, fb["cementum"]),
        ("pdl", f_pdl, fb["pdl"]),
        ("pulp-chamber", np.minimum(f_pulp, (ZZ - (z_cej + floor + 0.4))) if multi else np.minimum(f_pulp, ZZ - (z_cej - 0.8)), fb["chamber"]),
    ]:
        m = surface(fld, lo, h, frame, budget)
        if m is not None:
            L.meshes[name] = m

    # canals: below the chamber region
    zcut = (z_cej + floor + 0.4) if multi else (z_cej - 0.8)
    for name, lab, cf in canal_fields:
        fld = np.minimum.reduce([smax(cf, np.full_like(cf, -1), 0.01), sd + 0.02, zcut + 0.3 - ZZ])
        m = surface(fld, lo, h, frame, fb["canal"], smooth=4)
        if m is not None:
            L.meshes[name] = m
        # apical foramen landmark: last point of the canal path
        pth = [p for n, _, p in canal_paths if n == name][0]
        L.landmarks[f"apical-foramen-{name[6:]}"] = frame.to_world(pth[-2])

    # pulp horns: local peaks of the chamber
    ch = L.meshes.get("pulp-chamber")
    if ch is not None:
        vloc = frame.to_local(ch.vertices)
        top = vloc[vloc[:, 2] > vloc[:, 2].max() - 1.6]
        order = np.argsort(-top[:, 2])
        peaks = []
        for p in top[order]:
            if all(np.linalg.norm(p[:2] - q[:2]) > 1.3 for q in peaks):
                peaks.append(p)
            if len(peaks) >= 5:
                break
        for i, p in enumerate(peaks):
            # direction label
            ang = np.degrees(np.arctan2(p[1], p[0]))
            L.landmarks[f"pulp-horn-{i + 1}"] = frame.to_world(p)

    L.roots = root_infos
    L.cej_height = float(z_cej)
    L.landmarks["cervical-line"] = frame.to_world(np.array([0, 0, z_cej]))
    L.landmarks["apex"] = frame.to_world(np.array([0, 0, z_apex]))
    return L
