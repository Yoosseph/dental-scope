"""Landmark-fitted TMJ disc, an illustrative model rather than measured tissue.

Shape reference: https://pubmed.ncbi.nlm.nih.gov/12684970/
Thin intermediate zone between anterior and larger posterior bands.
"""
from __future__ import annotations

import numpy as np
import trimesh

from geometry import orient_outward


def disc_frame(condyle: np.ndarray):
    top = condyle[np.argmax(condyle[:, 2])]
    head = condyle[condyle[:, 2] > top[2] - 5]
    _, vectors = np.linalg.eigh(np.cov((head - head.mean(0)).T))
    major = vectors[:, 2].copy()
    major[2] = 0
    major /= np.linalg.norm(major)
    # Fix the eigenvector sign: +minor must mean posterior on BOTH sides.
    if major[0] < 0:
        major *= -1
    up = np.array([0., 0., 1.])
    minor = np.cross(up, major)
    return top, np.stack([major, minor, up]), np.ptp(head @ major), np.ptp(head @ minor)


def articular_disc(condyle: np.ndarray) -> trimesh.Trimesh:
    top, axes, ml, ap = disc_frame(condyle)
    sphere = trimesh.creation.icosphere(subdivisions=4)
    u, v, w = sphere.vertices.T
    # Rounded oval outline; posterior is slightly broader, without a hard rim.
    x = u * ml * .55 * (1 + .07 * v)
    # Centre the posterior band near the condylar summit; the intermediate
    # zone and anterior band extend forward, rather than centring the waist
    # on the summit as a symmetric ellipsoid would.
    y = v * ap * .75 - ap * .435
    # Approximate millimetre-scale proportions only, not patient measurements.
    anterior = np.exp(-((v + .62) / .25) ** 2)
    posterior = np.exp(-((v - .58) / .30) ** 2)
    thickness = 1.0 + 1.3 * anterior + 2.6 * posterior
    half = thickness * .5
    cap = np.sqrt(np.maximum(0., 1 - u * u - v * v))
    # The underside cups the condylar head. Both surfaces merge smoothly at
    # the oval margin; the intermediate zone stays thin rather than ballooned.
    underside = .55 - min(2., ml * .10) * u * u - min(3., ap * .20) * (v - .58) ** 2
    z = underside + half * cap + half * w
    vertices = np.column_stack([x, y, z]) @ axes + top
    return orient_outward(trimesh.Trimesh(vertices, sphere.faces, process=False))
