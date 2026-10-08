"""Draft schematic single-root morphology for permanent upper second premolars.

The source specimens have bifid roots. This teaching example uses one root;
it is not a measured reconstruction or a claim that variations do not occur.
Source: https://pubmed.ncbi.nlm.nih.gov/34389013/ . Expert review pending.
"""
import numpy as np
import trimesh
from tooth_layers import TYPE_PARAMS

def prepare_root(mesh, frame, arch, kind):
    if (arch, kind) != ('maxillary', 'second-premolar'):
        return mesh
    local = mesh.copy()
    local.vertices = frame.to_local(mesh.vertices)
    low, high = local.bounds[:, 2]
    cej = high - (high - low) * TYPE_PARAMS[arch, kind]['crown_ratio']
    # Keep the crown and cervical collar, cutting before the source bifurcation.
    join = cej - .6
    vertices, faces, _ = trimesh.intersections.slice_faces_plane(
        local.vertices, local.faces, [0, 0, 1], [0, 0, join])
    crown = trimesh.Trimesh(vertices, faces, process=True)
    crown.merge_vertices()
    edges = crown.edges_sorted
    unique, counts = np.unique(edges, axis=0, return_counts=True)
    boundary = unique[counts == 1]
    neighbors = {}
    for a, b in boundary:
        neighbors.setdefault(a, []).append(b)
        neighbors.setdefault(b, []).append(a)
    if not neighbors or any(len(v) != 2 for v in neighbors.values()):
        raise ValueError('Expected a closed cervical boundary')
    ring = [next(iter(neighbors))]
    previous = None
    while True:
        choices = neighbors[ring[-1]]
        nxt = choices[0] if choices[0] != previous else choices[1]
        if nxt == ring[0]:
            break
        previous = ring[-1]
        ring.append(nxt)
    if len(ring) != len(neighbors):
        raise ValueError('Root replacement must start above the bifurcation')
    base = crown.vertices[ring]
    center = (base[:, :2].min(0) + base[:, :2].max(0)) / 2
    offsets = base[:, :2] - center
    vertices = list(crown.vertices)
    faces = list(crown.faces)
    last = ring
    # The original collar outline transitions smoothly into a single apex.
    for t in np.linspace(0, 1, 49)[1:-1]:
        scale = (1 - t ** 1.4) ** .65
        xy = center + offsets * scale
        xy[:, 0] -= .45 * t * t  # small schematic distal apical curvature
        row = np.column_stack([xy, np.full(len(ring), join + t * (low-join))])
        current = list(range(len(vertices), len(vertices) + len(ring)))
        vertices.extend(row)
        for i in range(len(ring)):
            j = (i + 1) % len(ring)
            faces.extend([[last[i], last[j], current[j]], [last[i], current[j], current[i]]])
        last = current
    apex = len(vertices)
    vertices.append([center[0]-.45, center[1], low])
    faces.extend([[last[i], last[(i+1) % len(ring)], apex] for i in range(len(ring))])
    result = trimesh.Trimesh(vertices, faces, process=True)
    result.fix_normals()
    result.vertices = frame.to_world(result.vertices)
    result.fix_normals()
    if not result.is_watertight or result.volume <= 0:
        raise ValueError('Invalid schematic premolar root')
    return result
