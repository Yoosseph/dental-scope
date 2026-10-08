# Upper second premolar root correction

FDI 15 and 25 (permanent teeth) now use a schematic single root, replacing the
two-rooted BodyParts3D specimens in this teaching example. FDI 14 and 24 retain
their original two-rooted form. The crown and cervical collar are retained;
the root below the collar tapers continuously to one apex. Tissue layers and
canal paths are rebuilt from the corrected external surface.

This is **draft schematic anatomy pending dental expert review**, not a measured
reconstruction. Root dimensions and curvature are modeling choices. Existing
localized descriptions already describe the usual single root and acknowledge
anatomical variation; they remain unchanged. One root is not universal in real
patients: [Alqedairi et al., 2021](https://pubmed.ncbi.nlm.nih.gov/34389013/)
found one root and one canal to be the most common configuration for maxillary
second premolars, and two roots and canals for first premolars.

`premolar_roots.prepare_root` is shared by the full asset build and the selective
morphology refresh. Only 15/25 use the v10 tissue cache, preventing reuse of their
old bifid-root layers. The selective refresh updates core tooth shells, both
tooth-layer GLBs, and the associated manifest entries.

Regression: `python -m unittest discover -s tools/pipeline -p test_premolar_roots.py`
checks single root cross-sections at four depths, closed positive-volume geometry,
preserved crown surface, and unchanged first-premolar / lower-premolar inputs.
Before correction it failed for both 15 and 25 at 55% root depth (two contours).

Selective rebuild (from the repository root):

```sh
python tools/pipeline/refresh_morphology.py --bp3d tools/pipeline/raw/stl --out tools/pipeline/.cache/premolar-roots --only 15,25
# Optional if the native Python simplifier cannot load:
node tools/pipeline/simplify_morphology.mjs tools/pipeline/.cache/premolar-roots
node tools/pipeline/refresh_morphology.mjs tools/pipeline/.cache/premolar-roots
```

The portable simplifier uses the existing meshoptimizer dependency, keeps shell
vertices unchanged, limits relative tissue surface error to 0.001, and rejects
open, inconsistently oriented, or non-positive-volume results. On this Windows
host the native Python simplifier was blocked by application control, so this
portable path was used. No application-control settings were changed.

Verification of the final decoded compressed assets: 15/25 each have one contour
at 35%, 55%, 75%, and 90% root depth; 14/24 retain two contours at the latter
three depths. All 18 checked shell/tissue meshes are closed, consistently wound,
and have positive volume. Both corrected shells were visually inspected from
buccal and mesial projections. Description coverage and production build pass.
