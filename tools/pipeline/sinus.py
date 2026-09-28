"""
Maxillary sinus (issue #25).

Neither BodyParts3D nor Z-Anatomy models the maxillary sinus: in both, the maxilla is a solid
body. The sinus is therefore modelled from this skull's maxilla: the body is hollowed out
inward, leaving a bony wall of `wall` mm, so the cavity follows the real outer shape of the
bone (orbital floor above, facial wall in front, infratemporal wall behind, and the zygomatic
recess). Medially it stops at the lateral wall of the nasal cavity, taken as the lateral edge of
the inferior nasal concha, which is attached to that wall (the solid maxilla also fills the
palate and the bone below the nasal floor, which are not sinus). The floor is kept clear of the tooth roots and of the
nerves that run in the walls (superior alveolar nerves, infraorbital nerve), by `root_gap` and
`nerve_gap` mm. Thin remnants (the palatine and frontal processes) are removed by an opening
and the largest remaining cavity is kept. Provenance: 'modeled'.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import trimesh
from scipy import ndimage
from skimage import measure

from geometry import decimate, orient_outward


@dataclass
class SinusResult:
    mesh: trimesh.Trimesh
    volume_cm3: float
    #: distance (mm) from each tooth's root apex to the sinus floor, keyed by FDI number
    apex_gap: dict[int, float]


def _ball(radius: float, pitch: float) -> np.ndarray:
    n = int(np.ceil(radius / pitch))
    x = np.arange(-n, n + 1) * pitch
    return (x[:, None, None] ** 2 + x[None, :, None] ** 2 + x[None, None, :] ** 2) <= radius * radius + 1e-9


class _Grid:
    def __init__(self, lo: np.ndarray, hi: np.ndarray, pitch: float):
        self.lo, self.pitch = lo, pitch
        self.shape = tuple(np.ceil((hi - lo) / pitch).astype(int) + 1)

    def solid(self, mesh: trimesh.Trimesh) -> np.ndarray:
        vox = mesh.voxelized(self.pitch).fill()
        return self.mark(vox.points)

    def mark(self, pts: np.ndarray) -> np.ndarray:
        g = np.zeros(self.shape, bool)
        idx = np.round((np.asarray(pts) - self.lo) / self.pitch).astype(int)
        ok = np.all((idx >= 0) & (idx < np.array(self.shape)), axis=1)
        g[tuple(idx[ok].T)] = True
        return g


def build_sinus(maxilla: trimesh.Trimesh, teeth: dict[int, trimesh.Trimesh], apices: dict[int, np.ndarray],
                nerves: list[tuple[np.ndarray, np.ndarray]], nasal_wall_x: float, *, wall: float = 1.0, root_gap: float = 1.0,
                nerve_gap: float = 0.8, pitch: float = 0.4, faces: int = 5000) -> SinusResult:
    """Model one maxillary sinus (all inputs in BodyParts3D millimetres).

    `teeth`: the upper teeth of that side; `apices`: their root apex points; `nerves`: polylines
    with radii of the nerves running in the sinus walls; `nasal_wall_x`: x of the lateral nasal
    wall (the sinus lies on the side of it away from the midline).
    """
    g = _Grid(maxilla.bounds[0] - 2, maxilla.bounds[1] + 2, pitch)
    body = g.solid(maxilla)
    cavity = ndimage.binary_erosion(body, _ball(wall, pitch))
    xs = g.lo[0] + pitch * np.arange(g.shape[0])
    lateral = np.sign(maxilla.centroid[0])  # +1 for the left maxilla (+X), -1 for the right
    cavity[(xs - nasal_wall_x) * lateral < wall] = False

    # keep clear of the roots and of the nerves in the walls
    blocked = np.zeros(g.shape, bool)
    for t in teeth.values():
        blocked |= g.solid(t)
    blocked = ndimage.binary_dilation(blocked, _ball(root_gap, pitch))
    tube = np.zeros(g.shape, bool)
    for pts, rad in nerves:
        # dense samples along the path, each dilated by its own radius + the gap
        seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
        for (a, b, ra, rb, L) in zip(pts[:-1], pts[1:], rad[:-1], rad[1:], seg):
            n = max(2, int(np.ceil(L / (pitch * 0.5))))
            t = np.linspace(0, 1, n)[:, None]
            p = a * (1 - t) + b * t
            r = (ra * (1 - t[:, 0]) + rb * t[:, 0]) + nerve_gap
            for rr in np.unique(np.round(r / pitch) * pitch):
                sel = np.abs(np.round(r / pitch) * pitch - rr) < 1e-9
                m = g.mark(p[sel])
                tube |= ndimage.binary_dilation(m, _ball(max(rr, pitch), pitch)) if m.any() else m
    cavity &= ~blocked & ~tube

    # thin remnants of the processes go; the largest cavity is the sinus
    cavity = ndimage.binary_opening(cavity, _ball(2.0, pitch))
    lab, n = ndimage.label(cavity)
    if n == 0:
        raise ValueError("maxillary sinus: no cavity left in the maxilla")
    sizes = ndimage.sum(cavity, lab, range(1, n + 1))
    cavity = lab == (int(np.argmax(sizes)) + 1)

    # smooth surface: marching cubes on a slightly blurred field, then re-check the clearances
    field = ndimage.gaussian_filter(cavity.astype(np.float32), 1.0)
    field[~ndimage.binary_dilation(cavity, _ball(pitch, pitch))] = 0  # never grow into the clearances
    verts, tris, _, _ = measure.marching_cubes(np.pad(field, 1), 0.5)
    verts = (verts - 1) * pitch + g.lo
    mesh = trimesh.Trimesh(verts, tris[:, ::-1], process=True)
    mesh = max(mesh.split(only_watertight=False), key=lambda m: len(m.faces))
    trimesh.smoothing.filter_taubin(mesh, iterations=12)
    mesh = orient_outward(decimate(mesh, faces))

    apex_gap = {}
    if len(apices):
        d = trimesh.proximity.signed_distance(mesh, np.array(list(apices.values())))
        apex_gap = {f: round(float(-x), 2) for f, x in zip(apices, d)}  # outside → positive gap
    return SinusResult(mesh, round(abs(mesh.volume) / 1000, 2), apex_gap)
