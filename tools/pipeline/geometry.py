"""Small geometry helpers for the Dental Scope pipeline."""
from __future__ import annotations

import numpy as np
import trimesh

try:
    import fast_simplification
except ImportError:  # pragma: no cover
    fast_simplification = None


def orient_outward(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Orient a closed surface by signed volume without a graph dependency."""
    if mesh.volume < 0:
        mesh.invert()
    return mesh


def smooth_taubin(mesh: trimesh.Trimesh, iterations: int = 4) -> None:
    """Volume-preserving Laplacian smoothing using NumPy vertex adjacency."""
    faces = np.asarray(mesh.faces)
    edges = np.vstack((faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]))
    edges = np.vstack((edges, edges[:, ::-1]))
    src, dst = edges.T
    degree = np.bincount(src, minlength=len(mesh.vertices)).clip(min=1)[:, None]
    verts = np.asarray(mesh.vertices).copy()
    for _ in range(iterations):
        for strength in (0.5, -0.53):
            neighbour_sum = np.zeros_like(verts)
            np.add.at(neighbour_sum, src, verts[dst])
            verts += strength * (neighbour_sum / degree - verts)
    mesh.vertices = verts


def decimate(mesh: trimesh.Trimesh, target_faces: int) -> trimesh.Trimesh:
    if fast_simplification is None or len(mesh.faces) <= target_faces:
        return mesh
    v, f = fast_simplification.simplify(
        np.asarray(mesh.vertices, np.float32), np.asarray(mesh.faces, np.int32),
        target_reduction=1 - target_faces / len(mesh.faces))
    out = trimesh.Trimesh(v, f, process=True)
    return orient_outward(out)


def submesh(mesh: trimesh.Trimesh, face_mask: np.ndarray) -> trimesh.Trimesh | None:
    idx = np.nonzero(face_mask)[0]
    if len(idx) == 0:
        return None
    return mesh.submesh([idx], append=True)


def catmull_rom(points: np.ndarray, samples_per_seg: int = 10) -> np.ndarray:
    p = np.asarray(points, float)
    p = np.vstack([p[0] * 2 - p[1], p, p[-1] * 2 - p[-2]])
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for t in np.linspace(0, 1, samples_per_seg, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(p[-2])
    return np.array(out)


def tube(points: np.ndarray, r0: float, r1: float | None = None, sides: int = 10, samples: int = 8) -> trimesh.Trimesh:
    """Sweep a circle along a Catmull-Rom spline through `points` (parallel transport)."""
    r1 = r0 if r1 is None else r1
    c = catmull_rom(points, samples)
    n = len(c)
    tangents = np.gradient(c, axis=0)
    tangents /= np.linalg.norm(tangents, axis=1, keepdims=True)
    ref = np.array([0, 0, 1.0]) if abs(tangents[0][2]) < 0.9 else np.array([1.0, 0, 0])
    normal = np.cross(tangents[0], ref)
    normal /= np.linalg.norm(normal)
    verts = []
    ang = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    for i in range(n):
        t = tangents[i]
        normal = normal - t * (normal @ t)
        normal /= np.linalg.norm(normal)
        binormal = np.cross(t, normal)
        s = i / (n - 1)
        r = r0 + (r1 - r0) * s
        ring = c[i] + r * (np.cos(ang)[:, None] * normal + np.sin(ang)[:, None] * binormal)
        verts.append(ring)
    verts = np.concatenate(verts)
    faces = []
    for i in range(n - 1):
        for j in range(sides):
            a = i * sides + j
            b = i * sides + (j + 1) % sides
            cc = (i + 1) * sides + j
            d = (i + 1) * sides + (j + 1) % sides
            faces += [[a, cc, b], [b, cc, d]]
    # caps
    s0 = len(verts)
    verts = np.vstack([verts, c[0], c[-1]])
    for j in range(sides):
        faces.append([s0, j, (j + 1) % sides])
        base = (n - 1) * sides
        faces.append([s0 + 1, base + (j + 1) % sides, base + j])
    m = trimesh.Trimesh(verts, np.array(faces), process=True)
    return orient_outward(m)


def ellipsoid_disc(center, axes: np.ndarray, radii, concavity=0.35, sub=3) -> trimesh.Trimesh:
    """Biconcave disc: an ellipsoid whose poles are pushed inward."""
    s = trimesh.creation.icosphere(subdivisions=sub)
    v = s.vertices.copy()
    r2 = v[:, 0] ** 2 + v[:, 1] ** 2
    v[:, 2] *= 1 - concavity * np.exp(-r2 * 3.0)
    v = v * np.array(radii)
    v = v @ axes + np.asarray(center)
    m = trimesh.Trimesh(v, s.faces, process=True)
    return orient_outward(m)


def surface_point(mesh: trimesh.Trimesh, origin, direction):
    """First hit of a ray on the mesh, or None."""
    loc, _, _ = mesh.ray.intersects_location([origin], [direction / np.linalg.norm(direction)])
    if len(loc) == 0:
        return None
    d = np.linalg.norm(loc - origin, axis=1)
    return loc[np.argmin(d)]


def tube_polyline(points: np.ndarray, radii, sides: int = 12, cap: bool = True) -> trimesh.Trimesh:
    """Sweep a circle along an already dense polyline with a per-point radius (parallel transport)."""
    c = np.asarray(points, float)
    keep = np.r_[True, np.linalg.norm(np.diff(c, axis=0), axis=1) > 1e-6]
    c = c[keep]
    r = np.broadcast_to(np.asarray(radii, float), (len(keep),))[keep]
    n = len(c)
    tangents = np.gradient(c, axis=0)
    tangents /= np.linalg.norm(tangents, axis=1, keepdims=True)
    ref = np.array([0, 0, 1.0]) if abs(tangents[0][2]) < 0.9 else np.array([1.0, 0, 0])
    normal = np.cross(tangents[0], ref)
    normal /= np.linalg.norm(normal)
    ang = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    verts = []
    for i in range(n):
        t = tangents[i]
        normal = normal - t * (normal @ t)
        normal /= np.linalg.norm(normal)
        binormal = np.cross(t, normal)
        verts.append(c[i] + r[i] * (np.cos(ang)[:, None] * normal + np.sin(ang)[:, None] * binormal))
    verts = np.concatenate(verts)
    faces = []
    for i in range(n - 1):
        for j in range(sides):
            a, b = i * sides + j, i * sides + (j + 1) % sides
            cc, d = (i + 1) * sides + j, (i + 1) * sides + (j + 1) % sides
            faces += [[a, cc, b], [b, cc, d]]
    if cap:
        s0 = len(verts)
        verts = np.vstack([verts, c[0], c[-1]])
        base = (n - 1) * sides
        for j in range(sides):
            faces.append([s0, j, (j + 1) % sides])
            faces.append([s0 + 1, base + (j + 1) % sides, base + j])
    m = trimesh.Trimesh(verts, np.array(faces), process=False)
    return orient_outward(m)
