"""Geometry checks: python -m unittest discover -s tools/pipeline -p test_tmj.py"""
import unittest

import numpy as np
import trimesh

from tmj import articular_disc, disc_frame


class DiscTests(unittest.TestCase):
    def setUp(self):
        self.head = trimesh.creation.icosphere(subdivisions=3).vertices * [10, 5, 4]

    def test_closed_surface_and_bilateral_orientation(self):
        for side in (-1, 1):
            condyle = self.head + [side * 45, 0, 0]
            top, axes, _, _ = disc_frame(condyle)
            self.assertGreater(axes[1, 1], 0, 'posterior axis must not flip across the joint')
            mesh = articular_disc(condyle)
            self.assertTrue(mesh.is_watertight)
            self.assertTrue(mesh.is_winding_consistent)
            self.assertGreater(mesh.volume, 0)
            self.assertTrue(np.isfinite(mesh.vertex_normals).all())
            self.assertLess(np.linalg.norm(mesh.centroid - top), 6)

    def test_front_and_rear_bands_are_thicker_than_middle(self):
        mesh = articular_disc(self.head)
        # Actual mesh intersections on a sagittal slice, independent of the
        # generator's thickness equation; catches a ballooned/flat disc.
        top, axes, _, ap = disc_frame(self.head)
        thicknesses = []
        for v in (-.60, 0, .60):
            origin = top + axes[1] * (v * ap * .75 - ap * .435) + [0, 0, 10]
            hits, _, _ = mesh.ray.intersects_location([origin], [[0, 0, -1]])
            self.assertEqual(len(hits), 2)
            thicknesses.append(np.ptp(hits[:, 2]))
        anterior, middle, posterior = thicknesses
        self.assertGreater(anterior, middle * 1.4)
        self.assertGreater(posterior, anterior * 1.2)


if __name__ == '__main__':
    unittest.main()
