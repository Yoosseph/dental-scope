"""Draft teaching relief fitted to BodyParts3D crowns, in source millimetres.

Patterns follow the US Air Force Dental Laboratory manual, chapter 4, and
Doctoropsy's tooth morphology teaching. These coefficients/placements are
schematic, not measurements. Roots and the modeled cervical margin are retained.
See docs/student-feedback-implementation.md for sources and limitations.
"""
import numpy as np
import trimesh
from geometry import smooth_taubin, orient_outward
from tooth_layers import TYPE_PARAMS

FACIAL_KEYS = {'labial-ridge', 'buccal-ridge'}


def ramp(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def distance(points, path):
    out = np.full(len(points), np.inf)
    for a, b in zip(path[:-1], path[1:]):
        a, b = np.asarray(a), np.asarray(b)
        ab = b - a
        t = np.clip((points - a) @ ab / max(ab @ ab, 1e-10), 0, 1)
        out = np.minimum(out, np.linalg.norm(points - a - t[:, None] * ab, axis=1))
    return out


def pattern(arch, kind):
    """Posterior xy; anterior and facial ridges use x/crown-height."""
    if kind.endswith('incisor') or kind == 'canine':
        result = [('cingulum', [[0, .18]]),
                  ('mesial-marginal-ridge', [[.65, .24], [.72, .65], [.52, .90]]),
                  ('distal-marginal-ridge', [[-.65, .24], [-.72, .65], [-.52, .86]])]
        if kind == 'canine':
            result += [('cusp-tip', [[.05, .97]]), ('lingual-ridge', [[0, .22], [0, .55], [.05, .93]]),
                       ('mesiolingual-fossa', [[.32, .53]]), ('distolingual-fossa', [[-.32, .53]]),
                       ('labial-ridge', [[0, .12], [0, .60], [.05, .93]])]
        else:
            result += [('incisal-edge', [[-.66, .95], [0, .99], [.66, .97]]), ('lingual-fossa', [[0, .56]])]
        return result
    if 'premolar' in kind:
        lower_first = arch == 'mandibular' and kind == 'first-premolar'
        result = [('buccal-cusp', [[0, .48]]), ('lingual-cusp', [[0, -.47]]),
                  ('mesial-marginal-ridge', [[.68, -.38], [.74, 0], [.68, .38]]),
                  ('distal-marginal-ridge', [[-.68, -.38], [-.74, 0], [-.68, .38]]),
                  ('buccal-ridge', [[0, .12], [0, .55], [0, .93]])]
        if lower_first:
            result += [('transverse-ridge', [[0, -.47], [0, 0], [0, .48]]),
                       ('mesiolingual-groove', [[.35, -.10], [.63, -.43], [.80, -.70]]),
                       ('mesial-fossa', [[.43, 0]]), ('distal-fossa', [[-.43, 0]])]
        else:
            length = .57 if kind == 'first-premolar' else .42
            result += [('central-groove', [[-length, 0], [0, -.04], [length, 0]]),
                       ('mesial-fossa', [[length, 0]]), ('distal-fossa', [[-length, 0]])]
        return result
    upper = arch == 'maxillary'
    result = [('mesiobuccal-cusp', [[.43, .46]]), ('distobuccal-cusp', [[-.43, .46]]),
              ('mesiolingual-cusp', [[.43, -.46]]), ('distolingual-cusp', [[-.43, -.46]]),
              ('mesial-marginal-ridge', [[.72, -.40], [.80, 0], [.72, .42]]),
              ('distal-marginal-ridge', [[-.72, -.40], [-.80, 0], [-.72, .42]])]
    if upper:
        result += [('central-groove', [[.61, -.06], [.32, -.06], [.06, .08]]),
                   ('buccal-groove', [[.06, .08], [0, .42], [-.04, .78]]),
                   ('distal-oblique-groove', [[-.68, .06], [-.46, -.03], [-.12, -.43]]),
                   ('lingual-groove', [[-.12, -.43], [-.13, -.80]]),
                   ('oblique-ridge', [[.43, -.46], [.03, -.02], [-.43, .46]]),
                   ('central-fossa', [[.24, .06]]), ('distal-fossa', [[-.46, -.05]])]
    elif kind == 'first-molar':
        result += [('distal-cusp', [[-.76, .25]]),
                   ('central-groove', [[.65, 0], [.15, -.07], [-.40, .03], [-.69, -.11]]),
                   ('buccal-groove', [[.15, -.07], [.08, .80]]),
                   ('distobuccal-groove', [[-.40, .03], [-.55, .75]]),
                   ('lingual-groove', [[.15, -.07], [-.08, -.80]]), ('central-fossa', [[.15, -.07]])]
    else:
        result += [('central-groove', [[-.67, 0], [0, 0], [.67, 0]]),
                   ('buccal-groove', [[0, 0], [0, .80]]),
                   ('lingual-groove', [[0, 0], [0, -.80]]), ('central-fossa', [[0, 0]])]
    return result


class CrownRelief:
    def __init__(self, source, frame, arch, kind, cej):
        self.frame, self.arch, self.kind, self.cej = frame, arch, kind, cej
        v = frame.to_local(source.vertices)
        crown = v[v[:, 2] > cej + .6]
        self.centre = (crown[:, :2].min(0) + crown[:, :2].max(0)) / 2
        self.half = np.maximum(np.ptp(crown[:, :2], axis=0) / 2, .5)
        self.height = v[:, 2].max() - cej
        self.features = pattern(arch, kind)
        self.anterior = kind.endswith('incisor') or kind == 'canine'

    def deform(self, world):
        v = self.frame.to_local(world)
        xy = (v[:, :2] - self.centre) / self.half
        h = (v[:, 2] - self.cej) / self.height
        out = v.copy()
        if self.anterior:
            lingual = 1 - ramp(xy[:, 1], -.15, .25)
            strength = 1 if self.arch == 'maxillary' else .42
            xh = np.column_stack([xy[:, 0], h])
            d = np.zeros(len(v))
            for key, path in self.features:
                if key in FACIAL_KEYS:
                    continue
                dist = distance(xh, path) if len(path) > 1 else np.linalg.norm(xh - path[0], axis=1)
                ridge = 'ridge' in key or key == 'cingulum'
                if key not in ('incisal-edge', 'cusp-tip'):
                    d += (-.22 if ridge else .29) * np.exp(-(dist / (.13 if ridge else .20)) ** 2)
            out[:, 1] += d * lingual * strength * ramp(h, .06, .20) * (1 - ramp(h, .84, 1))
        else:
            d = np.zeros(len(v))
            for key, path in self.features:
                if key in FACIAL_KEYS:
                    continue
                dist = distance(xy, path) if len(path) > 1 else np.linalg.norm(xy - path[0], axis=1)
                if 'groove' in key:
                    d -= .40 * np.exp(-(dist / .12) ** 2)
                elif 'fossa' in key:
                    d -= .22 * np.exp(-(dist / .20) ** 2)
                elif 'ridge' in key:
                    d += .38 * np.exp(-(dist / .20) ** 2)
                else:
                    height = .80
                    if self.arch == 'mandibular' and self.kind == 'first-premolar' and key == 'lingual-cusp':
                        height = .08
                    if self.arch == 'maxillary' and key == 'distolingual-cusp':
                        height = .38
                    d += height * np.exp(-(dist / .30) ** 2)
            out[:, 2] += np.clip(d, -.65, 1.0) * ramp(h, .56, .88)
        xh = np.column_stack([xy[:, 0], h])
        for key, path in self.features:
            if key in FACIAL_KEYS:
                amplitude = .20 if self.kind in ('canine', 'first-premolar') else .12
                dist = distance(xh, path)
                out[:, 1] += amplitude * np.exp(-(dist / .20) ** 2) * ramp(xy[:, 1], -.10, .30) * ramp(h, .06, .20) * (1 - ramp(h, .88, 1))
        return self.frame.to_world(out)

    def refine(self, mesh):
        # Suppress tiny tessellation irregularities before adding readable relief.
        smooth = mesh.copy()
        smooth_taubin(smooth, iterations=3)
        heights = (self.frame.to_local(mesh.vertices)[:, 2] - self.cej) / self.height
        weights = ramp(heights, .10, .40)
        delta = smooth.vertices - mesh.vertices
        lengths = np.linalg.norm(delta, axis=1)
        delta *= np.minimum(1, .12 / np.maximum(lengths, 1e-10))[:, None]
        vertices = mesh.vertices + delta * weights[:, None]
        out = trimesh.Trimesh(self.deform(vertices), mesh.faces.copy(), process=False)
        return orient_outward(out)

    def enamel(self, enamel, source):
        # Snap only the OUTER surface of the voxel-derived enamel to the source;
        # apply the same continuous relief to inner tissues; cervical cap is fixed.
        closest, distances, triangles = source.nearest.on_surface(enamel.vertices)
        normals = source.face_normals[triangles]
        alignment = np.einsum('ij,ij->i', normals, enamel.vertex_normals)
        h = (self.frame.to_local(enamel.vertices)[:, 2] - self.cej) / self.height
        exterior = (distances < .20) & (alignment > .35) & (h > .10)
        vertices = enamel.vertices.copy()
        vertices[exterior] = closest[exterior]
        vertices = self.deform(vertices)
        return orient_outward(trimesh.Trimesh(vertices, enamel.faces.copy(), process=False))

    def annotations(self, mesh):
        result = []
        for key, path in self.features:
            # Dense piecewise-linear samples projected onto the actual refined surface.
            if len(path) == 1:
                samples = np.asarray(path)
            else:
                samples = np.concatenate([np.linspace(a, b, 12, endpoint=False) for a, b in zip(path[:-1], path[1:])] + [np.asarray(path[-1:])])
            local = np.zeros((len(samples), 3))
            local[:, 0] = self.centre[0] + samples[:, 0] * self.half[0]
            if key in FACIAL_KEYS:
                local[:, 2] = self.cej + samples[:, 1] * self.height
                local[:, 1] = self.centre[1] + self.half[1] * 2
                direction = -self.frame.buccal
            elif self.anterior:
                local[:, 2] = self.cej + samples[:, 1] * self.height
                local[:, 1] = self.centre[1] - self.half[1] * 2
                direction = self.frame.buccal
            else:
                local[:, 1] = self.centre[1] + samples[:, 1] * self.half[1]
                local[:, 2] = self.cej + self.height + 3
                direction = -self.frame.axis
            fitted = np.zeros((len(samples), 3))
            pending = np.arange(len(samples))
            for _ in range(8):
                origins = self.frame.to_world(local[pending])
                points, rays, _ = mesh.ray.intersects_location(origins, np.tile(direction, (len(pending), 1)), multiple_hits=False)
                fitted[pending[rays]] = points - direction * .08
                pending = pending[~np.isin(np.arange(len(pending)), rays)]
                if not len(pending):
                    break
                # The crown outline is not rectangular: fit outlying samples inward.
                local[pending, 0] = self.centre[0] + .85 * (local[pending, 0] - self.centre[0])
                if self.anterior or key in FACIAL_KEYS:
                    middle = self.cej + .50 * self.height
                    local[pending, 2] = middle + .85 * (local[pending, 2] - middle)
                else:
                    local[pending, 1] = self.centre[1] + .85 * (local[pending, 1] - self.centre[1])
            if len(pending):
                raise ValueError(f'{self.arch} {self.kind}: cannot fit {key} to crown')
            points = fitted
            result.append(dict(key=key, anchor=points[len(points) // 2], path=points if len(path) > 1 else None))
        return result
