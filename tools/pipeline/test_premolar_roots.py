"""Cross-sections catch a bifid external root even if metadata says 'single'."""
import unittest
from pathlib import Path
import numpy as np
from build_assets import load_stl, TEETH_FMA
from tooth_layers import make_frame, TYPE_PARAMS
from premolar_roots import prepare_root


class PremolarRootTests(unittest.TestCase):
    def test_other_permanent_teeth_keep_their_source_geometry(self):
        for fdi, arch, kind in [(14, 'maxillary', 'first-premolar'),
                                 (24, 'maxillary', 'first-premolar'),
                                 (35, 'mandibular', 'second-premolar')]:
            source = load_stl(Path(__file__).parent / 'raw/stl', TEETH_FMA[fdi])
            self.assertIs(prepare_root(source, None, arch, kind), source)

    def test_upper_second_premolars_have_one_apical_root(self):
        for fdi in (15, 25):
            with self.subTest(fdi=fdi):
                source = load_stl(Path(__file__).parent / 'raw/stl', TEETH_FMA[fdi])
                frame = make_frame(source, np.array([0., 0., -1.]), np.array([0., -1., 0.]), np.array([1., 0., 0.]))
                mesh = prepare_root(source, frame, 'maxillary', 'second-premolar')
                local = mesh.copy()
                local.vertices = frame.to_local(mesh.vertices)
                low, high = local.bounds[:, 2]
                cej = high - (high - low) * TYPE_PARAMS['maxillary', 'second-premolar']['crown_ratio']
                for depth in (.35, .55, .75, .9):
                    section = local.section(plane_origin=[0, 0, cej - depth * (cej-low)], plane_normal=[0, 0, 1])
                    self.assertIsNotNone(section)
                    self.assertEqual(len(section.discrete), 1, f'{fdi}: branched root at {depth:.0%} depth')
                self.assertTrue(mesh.is_watertight)
                self.assertTrue(mesh.is_winding_consistent)
                self.assertGreater(mesh.volume, 0)
                crown = source.vertices[frame.to_local(source.vertices)[:, 2] >= cej]
                self.assertLess(mesh.nearest.on_surface(crown)[1].max(), 1e-6)


if __name__ == '__main__':
    unittest.main()
