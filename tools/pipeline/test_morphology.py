"""Geometry regressions; anatomical sign-off is deliberately a separate review."""
import unittest
import numpy as np
import trimesh
from morphology import CrownRelief, pattern
from tooth_layers import Frame, TYPE_PARAMS, cervical_height


class MorphologyTests(unittest.TestCase):
    def test_family_topology(self):
        keys = lambda arch, kind: dict(pattern(arch, kind))
        upper = keys('maxillary', 'first-molar')
        self.assertEqual(upper['oblique-ridge'][0], upper['mesiolingual-cusp'][0])
        self.assertEqual(upper['oblique-ridge'][-1], upper['distobuccal-cusp'][0])
        self.assertIn('distal-cusp', keys('mandibular', 'first-molar'))
        self.assertNotIn('distal-cusp', keys('mandibular', 'second-molar'))
        self.assertNotIn('central-groove', keys('mandibular', 'first-premolar'))
        self.assertIn('mesial-marginal-groove', keys('maxillary', 'first-premolar'))
        self.assertNotIn('mesial-marginal-groove', keys('maxillary', 'second-premolar'))

    def test_deformation_does_not_fold_or_move_roots(self):
        source = trimesh.creation.icosphere(subdivisions=3)
        source.vertices *= [4, 4, 10]
        frame = Frame(np.zeros(3), np.array([0,0,1]), np.array([1,0,0]), np.array([0,1,0]))
        rng = np.random.default_rng(42)
        points = rng.uniform([-4,-4,-8], [4,4,10], (5000,3))
        for arch, kind in TYPE_PARAMS:
            with self.subTest(arch=arch, kind=kind):
                relief = CrownRelief(source, frame, arch, kind, 0)
                out = relief.deform(points)
                roots = points[:,2] <= cervical_height(points[:,0], points[:,1], 0, relief.cej_curve)
                np.testing.assert_allclose(out[roots], points[roots], atol=1e-12)
                # Regression for an angular CEJ singularity inside actual anterior
                # crowns: approaching the axis from x/y must give the same gate.
                core = np.array([[1e-6,0,relief.cej_curve*.75], [0,1e-6,relief.cej_curve*.75]])
                weights = relief.crown_weight(core)
                self.assertLess(abs(weights[0]-weights[1]), 1e-6)
                # Positive sampled Jacobian guards tissue order under the common
                # continuous map, including the transition at the curved CEJ.
                eps = 1e-4
                jac = np.stack([(relief.deform(points + np.eye(3)[i]*eps)-out)/eps for i in range(3)], axis=-1)
                self.assertGreater(np.linalg.det(jac).min(), .10)


if __name__ == '__main__':
    unittest.main()
