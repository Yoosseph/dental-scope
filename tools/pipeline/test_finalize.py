"""finalize() must reach the triangle budget or say loudly that it did not."""
import contextlib
import io
import unittest
from unittest import mock
import trimesh
import morphology
from morphology import finalize


class FinalizeTests(unittest.TestCase):
    def sphere(self):
        return trimesh.creation.icosphere(subdivisions=5)  # 20,480 closed triangles

    def test_reduces_a_closed_solid_to_its_budget(self):
        if morphology.fast_simplification is None:
            self.skipTest('native fast-simplification is unavailable')
        out = finalize(self.sphere(), 4000, 'sphere')
        self.assertLessEqual(len(out.faces), 4000)
        self.assertTrue(morphology.closed_solid(out))

    def test_manifold_fallback_keeps_a_thin_walled_shell_closed(self):
        # A 0.2 mm wall, like cementum: an outer sphere with an inward-facing inner one.
        outer = trimesh.creation.icosphere(subdivisions=5, radius=5.0)
        inner = trimesh.creation.icosphere(subdivisions=5, radius=4.8)
        inner.invert()
        shell = trimesh.util.concatenate([outer, inner])
        self.assertTrue(morphology.closed_solid(shell))
        out = morphology.manifold_simplify(shell, 8000)
        self.assertIsNotNone(out)
        self.assertLessEqual(len(out.faces), 8000)
        self.assertTrue(morphology.closed_solid(out))
        self.assertAlmostEqual(out.volume, shell.volume, delta=shell.volume * 0.02)

    def test_rejects_a_closed_result_the_simplifier_left_over_budget(self):
        if morphology.fast_simplification is None:
            self.skipTest('native fast-simplification is unavailable')
        mesh = self.sphere()
        unreduced = lambda v, f, **_: (v, f)  # stops before reducing anything, as on thin roots
        with mock.patch.object(morphology, 'decimate', lambda m, _: m), \
                mock.patch.object(morphology.fast_simplification, 'simplify', unreduced):
            out = finalize(mesh, 4000, 'sphere')
        self.assertLessEqual(len(out.faces), 4000)
        self.assertTrue(morphology.closed_solid(out))

    def test_leaves_a_mesh_within_budget_untouched(self):
        mesh = self.sphere()
        with mock.patch.object(morphology, 'fast_simplification', None):
            self.assertIs(finalize(mesh, len(mesh.faces), 'sphere'), mesh)

    def test_fails_instead_of_shipping_unsimplified_without_the_native_simplifier(self):
        with mock.patch.object(morphology, 'fast_simplification', None):
            with self.assertRaisesRegex(RuntimeError, 'sphere: fast-simplification is unavailable'):
                finalize(self.sphere(), 4000, 'sphere')

    def test_warns_when_no_closed_simplification_fits(self):
        if morphology.fast_simplification is None:
            self.skipTest('native fast-simplification is unavailable')
        mesh = self.sphere()
        stderr = io.StringIO()
        with mock.patch.object(morphology, 'closed_solid', lambda m: m is mesh), contextlib.redirect_stderr(stderr):
            self.assertIs(finalize(mesh, 4000, 'sphere'), mesh)
        self.assertIn('WARNING sphere: no closed simplification reached 4000 triangles; keeping 20480 unsimplified', stderr.getvalue())


if __name__ == '__main__':
    unittest.main()
