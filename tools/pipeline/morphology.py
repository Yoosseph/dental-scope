"""Draft teaching relief fitted to BodyParts3D crowns, in source millimetres.

Patterns follow the US Air Force Dental Laboratory manual, chapter 4, and
Doctoropsy's tooth morphology teaching. These coefficients/placements are
schematic, not measurements. Roots and the modeled cervical margin are retained.
See docs/student-feedback-implementation.md for sources and limitations.
"""
import numpy as np
import trimesh
from geometry import smooth_taubin, orient_outward, decimate, fast_simplification
from tooth_layers import TYPE_PARAMS, cervical_height

FACIAL_KEYS = {'labial-ridge', 'buccal-ridge'}


def finalize(mesh, budget):
    """Never exchange a closed tissue solid for an open simplification."""
    reduced = decimate(mesh, budget)
    if reduced.is_watertight and reduced.is_winding_consistent and reduced.volume > 0:
        return reduced
    if fast_simplification is not None:
        for aggression in (3., 1., 0.):
            v, f = fast_simplification.simplify(np.asarray(mesh.vertices, np.float32), np.asarray(mesh.faces, np.int32),
                                               target_count=budget, agg=aggression, preserve_border=True)
            trial = orient_outward(trimesh.Trimesh(v, f, process=False))
            if trial.is_watertight and trial.is_winding_consistent and trial.volume > 0:
                return trial
    # Thin root walls can collapse under aggressive simplification. Keeping the
    # closed input is preferable to filling anatomical holes after the fact.
    return mesh


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
        # A central upper incisor has a distally biased cingulum. Lower incisors
        # have restrained relief; do not carve a canine-like divided fossa.
        shift = -.13 if arch == 'maxillary' and kind == 'central-incisor' else 0
        result = [('cingulum', [[shift, .23]]),
                  ('mesial-marginal-ridge', [[shift + .20, .23], [.56, .43], [.67, .73], [.57, .91]]),
                  ('distal-marginal-ridge', [[shift - .20, .23], [-.55, .43], [-.64, .68], [-.50, .86]])]
        if kind == 'canine':
            result += [('cusp-tip', [[.10, .97]]), ('lingual-ridge', [[0, .23], [.04, .55], [.10, .93]]),
                       ('mesiolingual-fossa', [[.32, .53]]), ('distolingual-fossa', [[-.32, .53]]),
                       ('labial-ridge', [[0, .12], [0, .60], [.05, .93]])]
        else:
            result += [('incisal-edge', [[-.66, .95], [0, .99], [.66, .97]]), ('lingual-fossa', [[0, .56]])]
        return result
    if 'premolar' in kind:
        lower_first = arch == 'mandibular' and kind == 'first-premolar'
        bx = -.10 if arch == 'maxillary' and kind == 'first-premolar' else .06
        lx = .12 if arch == 'maxillary' and kind == 'first-premolar' else 0
        result = [('buccal-cusp', [[bx, .48]]), ('lingual-cusp', [[lx, -.47]]),
                  ('mesial-marginal-ridge', [[.68, -.38], [.74, 0], [.68, .38]]),
                  ('distal-marginal-ridge', [[-.68, -.38], [-.74, 0], [-.68, .38]]),
                  ('buccal-ridge', [[0, .12], [0, .55], [0, .93]])]
        if lower_first:
            result += [('transverse-ridge', [[0, -.47], [0, 0], [0, .48]]),
                       ('mesiolingual-groove', [[.35, -.10], [.63, -.43], [.80, -.70]]),
                       ('mesial-fossa', [[.43, 0]]), ('distal-fossa', [[-.43, 0]])]
        else:
            length = .57 if kind == 'first-premolar' else .42
            # The lower second example is the two-cusp U form.
            middle = -.19 if arch == 'mandibular' else -.04
            result += [('central-groove', [[-length, 0], [-.23, middle], [.20, middle], [length, 0]]),
                       ('mesial-fossa', [[length, 0]]), ('distal-fossa', [[-length, 0]])]
            result += [('buccal-triangular-ridge', [[bx, .48], [bx * .5, .23], [0, .06]]),
                       ('lingual-triangular-ridge', [[lx, -.47], [lx * .5, -.27], [0, middle - .07]])]
            if arch == 'maxillary' and kind == 'first-premolar':
                result += [('mesial-marginal-groove', [[length, 0], [.76, -.04], [.88, -.12]])]
        return result
    upper = arch == 'maxillary'
    result = [('mesiobuccal-cusp', [[.43, .46]]), ('distobuccal-cusp', [[-.43, .46]]),
              ('mesiolingual-cusp', [[.43, -.46]]), ('distolingual-cusp', [[-.43, -.46]]),
              ('mesial-marginal-ridge', [[.72, -.40], [.80, 0], [.72, .42]]),
              ('distal-marginal-ridge', [[-.72, -.40], [-.80, 0], [-.72, .42]])]
    if upper:
        if kind != 'first-molar':
            result[3] = ('distolingual-cusp', [[-.40, -.39]])
        result += [('central-groove', [[.61, -.06], [.32, -.06], [.06, .08]]),
                   ('buccal-groove', [[.06, .08], [0, .42], [-.04, .78]]),
                   ('distal-oblique-groove', [[-.68, .06], [-.46, -.03], [-.12, -.43]]),
                   ('lingual-groove', [[-.12, -.43], [-.13, -.80]]),
                   ('oblique-ridge', [[.43, -.46], [.03, -.02], [-.43, .46]]),
                   ('central-fossa', [[.24, .06]]), ('distal-fossa', [[-.46, -.05]])]
    elif kind == 'first-molar':
        # Make room for the fifth cusp instead of overlaying it on the DB cusp.
        result[0] = ('mesiobuccal-cusp', [[.46, .48]])
        result[1] = ('distobuccal-cusp', [[-.20, .48]])
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
        self.cej_curve = TYPE_PARAMS[arch, kind]['cej_curve']
        v = frame.to_local(source.vertices)
        crown = v[v[:, 2] > cej + .6]
        self.centre = (crown[:, :2].min(0) + crown[:, :2].max(0)) / 2
        self.half = np.maximum(np.ptp(crown[:, :2], axis=0) / 2, .5)
        self.height = v[:, 2].max() - cej
        self.features = pattern(arch, kind)
        self.anterior = kind.endswith('incisor') or kind == 'canine'
        # Use one cleaned exterior for both the intact shell and enamel. Snapping
        # to the unfiltered source used to reintroduce its small scan wrinkles.
        self.exterior = source.copy()
        smooth_taubin(self.exterior, iterations=18)
        delta = self.exterior.vertices - source.vertices
        lengths = np.linalg.norm(delta, axis=1)
        delta *= np.minimum(1, .24 / np.maximum(lengths, 1e-10))[:, None]
        weights = ramp((v[:, 2] - cej) / self.height, .10, .40)
        weights *= self.crown_weight(v)
        self.exterior.vertices = source.vertices + delta * weights[:, None]

    def crown_weight(self, local):
        # Extend the external angular CEJ smoothly through the *interior*.
        # x²/(x²+y²) is singular at the tooth axis and folded the cingulum's
        # internal deformation despite an unchanged external root. This smooth
        # upper envelope is everywhere >= the original CEJ, so all roots stay fixed.
        x, y = local[:, 0], local[:, 1]
        core = (.30 * min(self.half)) ** 2
        guard = self.cej + self.cej_curve * (x*x + core) / (x*x + y*y + core)
        return ramp(local[:, 2] - guard, 0, 1.4)

    def subsidiary_grooves(self):
        """Short branches within fossae, not a shared cross stamped onto every tooth."""
        if self.anterior:
            return []
        if 'premolar' in self.kind:
            if self.arch == 'mandibular' and self.kind == 'first-premolar':
                return [([[.43, 0], [.56, .23]], .12), ([[-.43, 0], [-.57, .26]], .15)]
            length = .57 if self.kind == 'first-premolar' else .42
            branches = [([[s * length, 0], [s * .57, .28]], .18) for s in (-1, 1)]
            if self.kind == 'second-premolar' and self.arch == 'maxillary':
                branches += [([[s * .32, -.04], [s * .45, -.25]], .13) for s in (-1, 1)]
            return branches
        if self.arch == 'maxillary':
            return [([[.61, -.06], [.63, .24]], .17), ([[-.46, -.03], [-.60, -.29]], .16)]
        return [([[.60, 0], [.65, .26]], .16), ([[-.58, 0], [-.64, -.27]], .14)]

    def deform(self, world):
        v = self.frame.to_local(world)
        xy = (v[:, :2] - self.centre) / self.half
        h = (v[:, 2] - self.cej) / self.height
        out = v.copy()
        if self.anterior:
            lingual = 1 - ramp(xy[:, 1], -.15, .25)
            strength = 1 if self.arch == 'maxillary' else .48
            xh = np.column_stack([xy[:, 0], h])
            d = np.zeros(len(v))
            for key, path in self.features:
                if key in FACIAL_KEYS:
                    continue
                dist = distance(xh, path) if len(path) > 1 else np.linalg.norm(xh - path[0], axis=1)
                ridge = 'ridge' in key or key == 'cingulum'
                if key not in ('incisal-edge', 'cusp-tip'):
                    width = .24 if key == 'cingulum' else .13 if ridge else .29
                    amplitude = -.48 if key == 'cingulum' else -.32 if ridge else .40
                    d += amplitude * np.exp(-(dist / width) ** 2)
            out[:, 1] += d * lingual * strength * ramp(h, .06, .20) * (1 - ramp(h, .84, 1))
            if self.kind == 'canine':
                # Modest mesial cusp emphasis; retain source crown height/outline.
                tip = np.exp(-((xy[:, 0] - .10) / .26) ** 2)
                out[:, 2] += (.85 * tip - .55 * np.abs(xy[:, 0] - .10)) * ramp(h, .68, .98)
                out[:, 0] -= .35 * xy[:, 0] * ramp(h, .70, .98)
            else:
                # Thin the incisal third buccolingually, leaving the source edge
                # and its mesiodistal angles intact rather than adding serrations.
                out[:, 1] -= .23 * xy[:, 1] * ramp(h, .72, .97)
        else:
            d = np.zeros(len(v))
            for key, path in self.features:
                if key in FACIAL_KEYS:
                    continue
                dist = distance(xy, path) if len(path) > 1 else np.linalg.norm(xy - path[0], axis=1)
                if 'groove' in key:
                    # Broad valley plus a restrained narrow floor: geometry,
                    # never a painted dark line. Max avoids double-depth junctions.
                    pass
                elif 'fossa' in key:
                    d -= .28 * np.exp(-(dist / .24) ** 2)
                elif 'ridge' in key:
                    amplitude = .62 if key == 'oblique-ridge' else .44
                    d += amplitude * np.exp(-(dist / .13) ** 2)
                else:
                    height = 2.10
                    if self.arch == 'mandibular' and self.kind == 'first-premolar' and key == 'lingual-cusp':
                        height = .12
                    if self.arch == 'maxillary' and key == 'distolingual-cusp':
                        height = 1.08 if self.kind == 'first-molar' else .58
                    if key == 'distal-cusp':
                        height = 1.25
                    if key == 'lingual-cusp' and 'premolar' in self.kind and self.arch == 'maxillary':
                        height = 1.30 if self.kind == 'first-premolar' else 1.65
                    # Directional cusp slopes with a small rounded tip; family-specific heights remain.
                    delta = np.abs(xy - path[0])
                    radius = ((delta[:, 0] / .36) ** 1.5 + (delta[:, 1] / .39) ** 1.5 + .003) ** (1 / 1.5)
                    d += height * np.maximum(0, 1 - radius / 1.35) ** 1.25
            valley = np.zeros(len(v))
            for key, path in self.features:
                if 'groove' in key:
                    dist = distance(xy, path)
                    valley = np.maximum(valley, .30 * np.exp(-(dist / .16) ** 2) + .24 * np.exp(-(dist / .055) ** 2))
            for path, amplitude in self.subsidiary_grooves():
                valley = np.maximum(valley, amplitude * np.exp(-(distance(xy, path) / .075) ** 2))
            d -= valley
            out[:, 2] += np.where(d > 0, 2.4 * np.tanh(d / 2.4), np.maximum(d, -.72)) * ramp(h, .42, .82)
        xh = np.column_stack([xy[:, 0], h])
        for key, path in self.features:
            if key in FACIAL_KEYS:
                amplitude = .32 if self.kind in ('canine', 'first-premolar') else .14
                dist = distance(xh, path)
                out[:, 1] += amplitude * np.exp(-(dist / .20) ** 2) * ramp(xy[:, 1], -.10, .30) * ramp(h, .06, .20) * (1 - ramp(h, .88, 1))
        return self.frame.to_world(v + (out - v) * self.crown_weight(v)[:, None])

    def refine(self, mesh):
        # Subdivide BEFORE relief: the coarse source cannot sample narrow grooves.
        dense = self.exterior.subdivide()
        out = trimesh.Trimesh(self.deform(dense.vertices), dense.faces.copy(), process=False)
        return orient_outward(out)

    def enamel(self, enamel, source):
        # Snap only the OUTER surface of the voxel-derived enamel to the source;
        # apply the same continuous relief to inner tissues; cervical cap is fixed.
        enamel = enamel.copy()
        smooth_taubin(enamel, iterations=10)
        enamel = enamel.subdivide()
        closest, distances, triangles = self.exterior.nearest.on_surface(enamel.vertices)
        normals = self.exterior.face_normals[triangles]
        alignment = np.einsum('ij,ij->i', normals, enamel.vertex_normals)
        h = (self.frame.to_local(enamel.vertices)[:, 2] - self.cej) / self.height
        exterior = (1 - ramp(distances, .30, .50)) * (alignment > 0) * ramp(h, .08, .20)
        vertices = enamel.vertices.copy()
        vertices += (closest - vertices) * exterior[:, None]
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
