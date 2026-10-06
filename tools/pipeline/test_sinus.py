"""Engineering checks for schematic sinus geometry, not anatomical approval."""
import unittest
import numpy as np
from sinus import build_paranasal_teaching_spaces


class SinusGeometryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.spaces = build_paranasal_teaching_spaces()

    def test_closed_surfaces_with_valid_normals(self):
        self.assertEqual(len(self.spaces), 4)
        for key, mesh in self.spaces.items():
            with self.subTest(key=key):
                self.assertTrue(mesh.is_watertight)
                self.assertTrue(mesh.is_winding_consistent)
                self.assertGreater(mesh.volume, 0)
                self.assertTrue(np.isfinite(mesh.vertex_normals).all())
                self.assertGreater(mesh.area_faces.min(), 1e-8)
                self.assertEqual(len(mesh.split()), 1)

    def test_remains_in_previous_regional_envelopes(self):
        # Existing schematic regional envelopes, in BodyParts3D millimetres.
        for key, mesh in self.spaces.items():
            sign = -1 if key.endswith('right') else 1
            center, radius = ((sign * 11, -176, 1553), (9, 2.8, 12)) if key.startswith('frontal') else ((sign * 4.8, -125, 1537), (4.2, 7, 6.5))
            np.testing.assert_allclose(mesh.bounds, [np.array(center) - radius, np.array(center) + radius], atol=1e-6)

    def test_bilateral_spaces_leave_the_midline_clear(self):
        for group in ['frontal', 'sphenoidal']:
            right = self.spaces[f'{group}-sinus-right']
            left = self.spaces[f'{group}-sinus-left']
            self.assertLess(right.bounds[1, 0], 0)
            self.assertGreater(left.bounds[0, 0], 0)


if __name__ == '__main__':
    unittest.main()
