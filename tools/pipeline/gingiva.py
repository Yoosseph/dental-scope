"""Fit a continuous posterior gum ridge around the derived wisdom teeth.

Inputs are in BodyParts3D millimetres. The source has no wisdom teeth. Join
rounded upper collars and a fitted lower ridge to the source gum before carving
sockets, so every derived wisdom tooth has continuous support at its neck.
"""
from __future__ import annotations

from itertools import product
import numpy as np
import trimesh
from scipy import ndimage
from scipy.spatial import cKDTree
from skimage import measure

from geometry import decimate, orient_outward, smooth_taubin
from tooth_layers import TYPE_PARAMS, Frame, ToothLayers


def _smooth_min(a, b, radius):
    h = np.clip(0.5 + 0.5 * (b - a) / radius, 0, 1)
    return b * (1 - h) + a * h - radius * h * (1 - h)


def expose_third_molar_crowns(gum: trimesh.Trimesh, teeth: dict[int, trimesh.Trimesh],
                             frames: dict[int, Frame], layers: dict[int, ToothLayers],
                             pitch: float = 0.22) -> trimesh.Trimesh:
    posterior = [f for f in (17, 18, 27, 28, 37, 38, 47, 48) if f in teeth]
    if not posterior:
        return gum.copy()
    upper = all(f < 30 for f in posterior)

    collars = []
    for fdi in posterior:
        frame = frames[fdi]
        local = frame.to_local(teeth[fdi].vertices)
        arch = "maxillary" if fdi < 30 else "mandibular"
        ratio = TYPE_PARAMS[(arch, "third-molar" if fdi % 10 == 8 else "second-molar")]["crown_ratio"]
        cej = layers[fdi].cej_height if fdi in layers else local[:, 2].max() - ratio * np.ptp(local[:, 2])
        neck = local[np.abs(local[:, 2] - cej) < 1.5]
        centre = (neck[:, :2].min(0) + neck[:, :2].max(0)) / 2
        # Leave tissue outside the socket around its entire circumference,
        # including the distal wall of each derived wisdom tooth.
        radii = np.max(np.abs(neck[:, :2] - centre), axis=0) + (1.5 if upper else 2.0)
        source_local = frame.to_local(gum.vertices)
        nearby = np.linalg.norm(source_local[:, :2] - centre, axis=1) < 12.0
        # Continue to the source gum's basal surface. A fixed shallow collar
        # leaves an overhanging shelf and a notch below the added rear molars.
        bottom = cej - 4.0 if upper else min(cej - 8.0, np.percentile(source_local[nearby, 2], 5))
        collars.append((fdi, frame, cej, centre, radii, bottom, neck[:, :2] - centre))

    envelope = [gum.bounds]
    for _, frame, cej, centre, radii, bottom, _ in collars:
        corners = np.array(list(product(
            (centre[0] - radii[0] - 3, centre[0] + radii[0] + 3),
            (centre[1] - radii[1] - 3, centre[1] + radii[1] + 3),
            (bottom - 3, cej + 3))))
        envelope.append(frame.to_world(corners))
    envelope = np.vstack(envelope)
    lo, hi = envelope.min(0) - 3, envelope.max(0) + 3
    shape = tuple(np.ceil((hi - lo) / pitch).astype(int) + 1)
    voxels = gum.voxelized(pitch).fill()
    solid = np.zeros(shape, dtype=bool)
    indices = np.round((voxels.points - lo) / pitch).astype(int)
    solid[tuple(indices.T)] = True
    # Negative inside; blending distance fields adds tissue as well as
    # removing the original raised pad, without folded or collapsed walls.
    field = ((ndimage.distance_transform_edt(~solid) - ndimage.distance_transform_edt(solid)) * pitch).astype(np.float32)
    del solid, voxels
    xs = (lo[0] + np.arange(shape[0], dtype=np.float32) * pitch)[:, None, None]
    ys = (lo[1] + np.arange(shape[1], dtype=np.float32) * pitch)[None, :, None]
    zs = (lo[2] + np.arange(shape[2], dtype=np.float32) * pitch)[None, None, :]
    ridge = np.full(shape, 1000., dtype=np.float32)
    influence = np.zeros(shape, dtype=np.float32)
    crest_sum = np.zeros(shape, dtype=np.float32)
    crest_weight = np.zeros(shape, dtype=np.float32)
    for fdi, frame, cej, centre, radii, bottom, neck_xy in collars:
        def project(direction):
            return ((xs - frame.origin[0]) * direction[0]
                    + (ys - frame.origin[1]) * direction[1]
                    + (zs - frame.origin[2]) * direction[2])
        x = project(frame.mesial) - centre[0]
        y = project(frame.buccal) - centre[1]
        z = project(frame.axis)
        power = 2 if upper else 4
        radial = (np.abs(x / radii[0]) ** power + np.abs(y / radii[1]) ** power) ** (1 / power)
        side = (radial - 1) * min(radii)
        # Slightly rounded crest at the cervical line; the final boolean
        # socket cut supplies the close-fitting scalloped tooth margin.
        top = z - (cej + 0.6 - 0.3 * radial ** 2)
        # Neighbouring molars lean toward the front. Taking the union of
        # their sloping top planes would carry the second molar's gum high
        # up the wisdom crown. Interpolate the local cervical planes instead.
        # Weight by distance to each tooth's neck contour, not its centre.
        # This keeps the margin against both teeth even where their tilted
        # cervical planes meet; centre weighting can expose a neighbour's root.
        tree = cKDTree(neck_xy)
        distance_to_neck = np.empty(shape, dtype=np.float32)
        for start in range(0, shape[0], 12):
            block = slice(start, start + 12)
            points = np.column_stack((x[block].ravel(), y[block].ravel()))
            distance_to_neck[block] = tree.query(points, workers=4)[0].reshape(x[block].shape)
        weight = 1 / (0.15 + distance_to_neck) ** 4
        crest_sum += weight * top
        crest_weight += weight
        shape_field = -_smooth_min(-side, -top, 1.0)
        shape_field = -_smooth_min(-shape_field, z - bottom, 1.5)
        ridge = _smooth_min(ridge, shape_field, 1.5)
        if fdi % 10 == 8:
            distance = np.sqrt((x / (radii[0] + 3)) ** 2 + (y / (radii[1] + 3)) ** 2)
            blend = np.clip((distance - 1.3) / 0.65, 0, 1)
            influence = np.maximum(influence, 1 - blend * blend * (3 - 2 * blend))
    crest = crest_sum / np.maximum(crest_weight, 1e-20)
    ridge = np.maximum(ridge, crest)
    # The upper source already exposes the crowns: add rounded collars to it
    # without replacing its natural palatal and basal contours with a ridge.
    fitted = _smooth_min(field, ridge, 1.0) if upper else field * (1 - influence) + ridge * influence
    # Replace the raised source pad only at the crest. Below the tooth necks,
    # retain and smoothly join the original body instead of cutting it away.
    basal_union = _smooth_min(field, fitted, 2.5)
    basal = np.clip((-crest - 2.0) / 3.0, 0, 1)
    basal = basal * basal * (3 - 2 * basal) * influence
    field = fitted if upper else fitted * (1 - basal) + basal_union * basal
    field = ndimage.gaussian_filter(field, sigma=0.8)
    vertices, faces, _, _ = measure.marching_cubes(field, level=0, spacing=(pitch,) * 3)
    result = trimesh.Trimesh(vertices + lo, faces, process=True)
    result = max(result.split(), key=lambda part: abs(part.volume))
    result = orient_outward(result)
    smooth_taubin(result, iterations=5)
    return decimate(result, 45000)
