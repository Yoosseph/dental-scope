# Tooth visualization revision — 2026-10-05

All work is left uncommitted for owner review. Existing unrelated changes are retained. Nothing was deployed. Anatomical content remains **draft / schematic**, pending dental expert and translation review.

## Follow-up to owner feedback

All bilateral ethmoidal air-cell meshes, registry entries, translated selectable descriptions and sinus controls were removed; the ethmoid bone remains. The targeted sinus refresh also deletes retired nodes from an existing context GLB, and the full generator no longer creates them. Regression and browser checks verify their absence.

The first pass still looked too rounded and glossy. The follow-up narrows directional posterior cusp slopes and ridge crests, increases tooth-specific cusp relief, tapers canine tips and thins incisal edges. A smooth positive displacement bound replaces hard clipping at cusp tops. Reduced upper distolingual cusps and the lower first-premolar lingual cusp remain restrained. These are schematic modeling coefficients, not new anatomical measurements. The same deformation is applied to internal tissues and landmarks, and overlays are fitted again after final simplification.

Enamel clearcoat is reduced to 0.025, roughness is 0.38 (shell 0.40), and specular intensity is 0.48. A broad, restrained cervical warmth fades toward the tip; it does not trace grooves. This reduces the uniform coated-plastic appearance. The result remains an illustrative atlas model, not photorealistic dental capture: broad source contours and small residual surface irregularities are still visible.

The comparison viewer defaults to the previous pass versus the final revision; its reference selector also offers the original baseline. The previous `after/` captures remain intact; final captures are in `revised/`.

## What changed

The morphology pipeline now samples relief on a subdivided source surface before simplification. It uses connected cusp slopes and valleys with a broader opening and a narrow floor, rather than one Gaussian bump shape for every cusp. Small subsidiary branches are tooth-family dependent. The intact shell and generated enamel use the same cleaned source exterior; enamel is smoothed before projection to reduce voxel wrinkles. The source outline and external roots are retained, with a bounded crown cleanup. A shared curved cervical boundary prevents relief displacing the root-facing part of a proximal surface.

Anterior relief distinguishes the stronger upper cingulum/marginal ridges from restrained lower relief. Upper central incisors have a distal cingulum bias. Canines have a mesially biased cusp emphasis, connected lingual ridge and two fossae; incisor edges are thinned modestly without invented serrations. Premolars distinguish the offset upper first cusp tips, its longer groove and mesial marginal crossing, the shorter and more branched upper second groove, the lower first transverse ridge/small lingual cusp and a representative lower second two-cusp U form. Upper molars retain a continuous mesiolingual–distobuccal oblique ridge and a reduced distolingual cusp on second-molar examples. The lower first pattern makes room for a separate distal cusp; the lower second retains its four-cusp cross.

The displacement field also maps dentin, pulp and landmarks, preserving their relationship in section and separation views. Rebuilt internal tissues remain procedural teaching solids, not segmented patient anatomy. The audit found pre-existing four-face edge pinches in cached dentin/cementum/PDL. A fresh meshing pass and closed-solid-preserving simplification replace those caches; an invalid simplification is never accepted just to meet a triangle budget.

Ivory enamel has restrained clearcoat and low-contrast material variation. Crevice pigment is limited to 2.5% on enamel; visible grooves must come from geometry and illumination. Roots retain their warmer, rougher material. An oblique camera-relative study light replaces the frontal study light; overview lights are disabled during isolated study so upper and lower surfaces receive comparable directional contrast. Study framing considers the control tray and header and focuses on the crown.

Optional paths are fitted after final mesh simplification and depth-tested. Labels use the complete enamel transform and a tight surface-specific occlusion tolerance. The selected feature marker is depth-tested too, follows enamel during separation, and disappears when the overlay is disabled or the crown is sectioned/removed. Three added selectable features (buccal/lingual triangular ridges and the upper first premolar mesial marginal groove) have individual descriptions in English, Swedish, German, Spanish and Latin, with sources and draft status.

## Evidence and sources

- The supplied BoneBox molar/canine images and Primary Grooves graphic are retained in `docs/references/student-feedback-2026-10-05/`. They informed readability, broad enamel slopes and line placement only. Their artwork was not copied, and no measurements were derived from pixels. The identity of the tooth in the Primary Grooves graphic remains unconfirmed.
- [Peer-reviewed premolar chapter, Gazi University authors](https://www.intechopen.com/chapters/62386): upper first cusp asymmetry and marginal groove, upper second supplementary grooves, lower first cusp disparity, lower second U/H/Y variation. The parameters and exact coordinates here are modeling choices.
- [Dental Anatomy and Morphology of Permanent Teeth](https://www.intechopen.com/chapters/86255) and [Anatomy Standard permanent dentition](https://www.anatomystandard.com/ossa-et-juncturae/cranium/dentes-permanentes.html): cross-checks for tooth families, anterior landmarks and upper/lower molar topology; the latter cites Wheeler and FIPAT.
- [US Air Force dental anatomy chapter](https://dentaltechnology.org/en/reference-library/air-force-dental-laboratory-manual/volume-1/chapter-04.md): existing project reference. Its page did not expose readable chapter text to this session's web reader, so it was not the sole verification source.
- [Doctoropsy channel](https://www.youtube.com/@doctoropsyindia), especially [Permanent Maxillary Canine](https://www.youtube.com/watch?v=rui02HbcEt8): the indexed original description verifies its five-aspect teaching structure. Full video playback/transcript was unavailable to the web reader. No claim is made that the entire video was watched or that its measurements were validated. Anatomical changes were cross-checked against the readable dental references above.
- Three.js material/light behavior and Playwright capture APIs were checked using Context7 (`/mrdoob/three.js`, `/microsoft/playwright`).

## Remaining anatomical limits and asset investigation

BodyParts3D is a relatively coarse atlas source. Its existing proportions and root configurations take priority over an idealized replacement crown. Relief is more readable, but exact cusp inclinations, fissure depths, enamel thickness and occlusal contacts have not been measured or clinically validated. Residual source irregularity, cervical seams and the procedural enamel/dentin junction remain visible at extreme zoom. Small supplementary fissures are illustrative. Pulp horns follow the common deformation, not a new histological reconstruction. There is no population variation model, wear/age model or quantitative occlusal simulation.

The lower second premolar is explicitly a two-cusp example; three-cusp/Y alternatives are not supplied. Carabelli morphology and reduced-cusp variants are not reconstructed. Third molars remain derived from the second-molar source, not independently scanned third molars. These limits are not replaced by dark grooves, texture or unsupported precision.

Potential replacement sources were investigated without importing any third-party mesh:

| Candidate | Observed rights / suitability | Remaining work before adoption |
| --- | --- | --- |
| [PLOS Figshare: Self-assembled micro-CT for dental education](https://plos.figshare.com/articles/dataset/Self-assembled_micro-computed_tomography_for_dental_education/7522568) | Indexed repository record states CC BY 4.0 and describes reconstructed upper right third-molar images/models. | Direct repository access returned 403. Inspect actual downloadable contents, scan resolution and file-level license; this is not a verified complete adult dentition set. |
| [Extracted Mandibular First Molar by AJCBoyes](https://www.thingiverse.com/thing:2770645) | Indexed [mirror record](https://3dgo.app/models/thingiverse/2770645) describes a 15-micron XMT source and Public Domain Dedication, with decimation before upload. | The original page exposed no readable license/file content. Confirm original license and enclosed mesh, inspect wear/pathology and tissue availability. A single tooth cannot supply all requested families. |
| [Haberthür tooth-cohort method release](https://zenodo.org/records/3999402) | Original Zenodo record is a software release associated with a micro-CT study. | It is not itself proof of a licensed, ready-to-use anatomical mesh collection. Resolve raw scan data, tissue segmentation and dataset-specific rights separately. |

No complete replacement set with verified downloadable assets and redistribution rights was established in this session. Replacing the atlas would require anatomical review, explicit dataset provenance, root/tissue registration and a new comparison against the existing arch, not simply swapping in an attractive crown.

## Reproduction

The targeted refresh uses original STLs plus cached base tissue layers and writes revision-v9 caches for reproducibility. The complete build path uses the same relief and safe simplification. On this workstation Python is `tools/pipeline/.cache/venv/Scripts/python.exe`.

```text
python tools/pipeline/test_morphology.py
python tools/pipeline/refresh_morphology.py --bp3d tools/pipeline/raw/stl --out tools/pipeline/.cache/morphology-final
node tools/pipeline/refresh_morphology.mjs tools/pipeline/.cache/morphology-final
node tools/pipeline/validate_study_assets.mjs
npm test
npm run build
node tools/capture_tooth_review.mjs revised
python tools/make_tooth_review.py
```

The browser capture script expects a local Vite server (default port 5174) and Playwright/Chrome. `REVIEW_URL` and `PLAYWRIGHT_MODULE` can override those dependencies. `before` saves camera poses; `revised` replays them exactly for the 14-tooth comparison. Additional captures use the improved default framing. Baseline captures must be taken before overwriting the old assets; they cannot be reconstructed from the revised model.

Review evidence: [matching-angle comparison](screenshots/tooth-review/index.html), [saved camera poses](screenshots/tooth-review/poses.json), and per-run `checks.json`. Contact sheets crop the model region for scanning; full screenshots preserve the UI. Engineering checks do not constitute medical approval or physical-device performance certification.

## Completed engineering verification

- **187 tests passed across 26 files**, including description coverage, tooth-family registration, material behavior and overlay transforms/depth settings. Production TypeScript/Vite build passed.
- Python morphology regression tests passed for all 16 arch/type combinations, including the interior-axis cervical regression. The additional actual-tooth audit covered all **32 teeth**, 4,096 deformation samples per tooth and sampled coronal dentin/pulp containment. The smallest sampled Jacobian determinant was **0.586** (positive); this is an engineering sampling check, not a proof of global anatomical validity.
- The generator checks final closed topology, winding, finite coordinates and positive volume. Pre-export root vertices were preserved to floating-point tolerance (maximum displacement **3.6e-15 mm**); export simplification/compression still applies. Annotation samples were at most **0.168 mm** from generated enamel. Reports: [geometry](screenshots/tooth-review/geometry-validation.json), [coherence](screenshots/tooth-review/coherence-validation.json).
- The shipped-asset validator decoded **411 meshes / 9,273,762 triangles**, checking file sizes, registration, indices, finite coordinates/normals, counts and bounds.
- **140 matching-pose original, 140 previous-pass and 140 revised captures**: FDI 11–17 and 31–37, five surfaces, overlays off/on. The final browser run recorded no page/shader errors and no visible feature label whose anchor failed the independent occlusion ray check. Sheets for [upper](screenshots/tooth-review/revised-upper-off.jpg) and [lower](screenshots/tooth-review/revised-lower-off.jpg) teeth were visually reviewed with both overlay states.
- **40 additional screenshots** cover light/dark desktop/mobile views (390×844 phone viewport), separated layers and sections for 13, 16, 34 and 36. Example: [mobile dark upper molar](screenshots/tooth-review/revised/mobile-dark-16-on.png). The updated study framing deliberately centers crowns; ordinary tooth focus remains available for full roots. Matched baseline poses retain the earlier framing for fair comparison.

The topology fix increases asset cost: `core.glb` is approximately **6.18 MB**, and detailed teeth range from **0.55 to 3.48 MB**. Some thin tissue meshes retain extra triangles to remain closed. Mobile verification used desktop Chromium viewport emulation, not a physical low-end phone or a performance benchmark. Residual voxel contouring on generated root tissues and source-limited crown relief remain review items. No quizzes, contributor credits, commits or deployment were added by this revision.

Reload the local app after regeneration: an already-open Engine keeps loaded geometries in memory. The comparison viewer displays saved captures, not the live model. The final sinus capture and browser report confirm zero retired air-cell entries/meshes and exactly six bilateral sinus choices.
