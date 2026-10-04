# Sources for the About dialog

Every statement in the About dialog (`src/ui/Overlays.tsx`, `AboutDialog`) is listed here with where it comes from. When you change the dialog, update this file in the same commit.

Statements are one of three kinds:

- **Fact**: can be checked against an outside source or the repository's own data. Each has a citation.
- **Project description**: describes what Dental Scope is or does. It is checked against the code, not an outside source.
- **Project policy**: a decision the project makes, such as its licences or intended use. The source is the file where the decision is recorded.

Last checked: 2026-09-28.

## Facts about the 3D data

| # | Statement in the About dialog | Source | Checked |
|---|---|---|---|
| F1 | Jaws, teeth, skull and muscles come from *BodyParts3D* 3.0; the gingiva is derived from its gum meshes | `public/models/manifest.json`: every mesh carries a `provenance`; source meshes also carry a `sourceRef` (FMA ID). Meshes with `provenance: "source"` are the maxilla, mandible body, 28 teeth, the skull bones (plus the hyoid) and the muscles. Both gingivae are `derived`: the source gum meshes (FMA59763, FMA59764) with sockets cut around each tooth (see docs/assets.md). Top-level `source`: `"BodyParts3D 3.0 (DBCLS), CC BY-SA 2.1 JP"`. The pipeline that selects them is `tools/pipeline/build_assets.py`, and the FMA IDs are in `tools/pipeline/fma_ids.txt`. | ✔ |
| F2 | BodyParts3D is © The Database Center for Life Science (DBCLS) | DBCLS licence page: <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html>. The database paper is Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K. *BodyParts3D: 3D structure database for anatomical concepts.* Nucleic Acids Res. 2009;37(Database issue):D782–D785. PMID 18835852, <https://academic.oup.com/nar/article/37/suppl_1/D782/1000752>. Data archive DOI: <https://doi.org/10.18908/lsdba.nbdc00837-000> | ✔ |
| F3 | The BodyParts3D data used here is licensed under CC Attribution-Share Alike 2.1 Japan | The pipeline reads the verbatim mirror of BodyParts3D version 3.0 (20110915), <https://github.com/Kevin-Mattheus-Moerman/BodyParts3D>. Its README gives the licence as "Creative Commons Attribution-Share Alike 2.1 Japan" with the credit line "BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan". Licence text: <https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en> | ✔ (see note) |
| F4 | Third molars, alveolar bone, condyles and joint fossae are derived from those meshes | `manifest.json` `provenance: "derived"` covers exactly `tooth-18`, `tooth-28`, `tooth-38`, `tooth-48`, the maxillary and mandibular alveolar processes, the mandibular condyles and the articular fossae. The derivation steps are in `tools/pipeline/build_assets.py` and are also listed in `CREDITS.md` under "Modifications". | ✔ |
| F5 | Enamel, dentin, cementum, periodontal ligament, pulp and canals are modeled inside each real tooth shape using simplified, approximate proportions, not measurements | `manifest.json` `provenance: "modeled"` covers `enamel-*`, `dentin-coronal-*`, `dentin-radicular-*`, `cementum-*`, `pdl-*`, `pulp-chamber-*` and `canal-*`. The method is in `tools/pipeline/tooth_layers.py`: a signed-distance field of the real tooth shell, then layers at set thicknesses. Its docstring says these thicknesses are modelling parameters chosen for a readable schematic at screen scale, not measurements. The dialog used to say "typical proportions"; that wording had no reference behind it and was changed. | ✔ (corrected) |
| F6 | The superior alveolar nerves, the inferior alveolar vein, the pterygoid plexus and the joint discs are placed from anatomical landmarks to show relationships, not measured paths | `manifest.json` `provenance: "schematic"` covers exactly the posterior, middle and anterior superior alveolar nerves, the inferior alveolar veins, the pterygoid plexuses and the articular discs. The landmark placement is in `tools/pipeline/build_assets.py` (section "neurovascular"). | ✔ |
| F7 | Most nerves and vessels follow the Z-Anatomy atlas (CC BY-SA 4.0), fitted onto these jaws | `manifest.json` `provenance: "atlas"` covers the trigeminal, maxillary, mandibular, inferior alveolar, incisive, mental, lingual, buccal and infraorbital nerves; the external carotid, maxillary, inferior alveolar, posterior superior alveolar, descending palatine, buccal and facial arteries; and the internal jugular, retromandibular, maxillary and facial veins. The external jugular vein was removed on 2026-09-28 (issue #26). Source: Z-Anatomy, <https://github.com/Z-Anatomy/Models-of-human-anatomy>, whose `License.txt` gives CC BY-SA 4.0. `tools/pipeline/extract_z_anatomy.py` samples the curves and fits the Z-Anatomy mandible and maxillae onto the BodyParts3D ones (similarity ICP; median mandible surface distance after the fit 0.27 mm). | ✔ |
| F8 | The maxillary sinuses are modeled inside the maxilla, as neither source includes them | Neither BodyParts3D (`FMA53649`, `FMA53650`) nor Z-Anatomy (`Maxilla.r` / `.l`; its paranasal sinus objects cover only the frontal and sphenoid sinuses) models a maxillary sinus: both maxillae are solid bodies (checked 2026-09-28 by point-containment tests). `manifest.json` `provenance: "modeled"` covers `maxillary-sinus-right` and `maxillary-sinus-left`; the method is in `tools/pipeline/sinus.py` and its docstring; `manifest.sinus` records the volumes and root apex → floor distances, and `validate_assets.py` checks them. | ✔ |

**Note on F3.** DBCLS's own licence page (<https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html>, checked 2026-09-26) now offers BodyParts3D under **Creative Commons Attribution 4.0 International**, with the credit "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International". Dental Scope's models were built from the version 3.0 mirror, which was released under CC BY-SA 2.1 JP. The About dialog therefore still names that licence, and the derived models in `public/models/` stay under it (share-alike). Moving to CC BY 4.0 would mean rebuilding the models from the DBCLS distribution and changing `CREDITS.md`, `docs/assets.md`, the README and the About dialog together. That is a licensing decision for the maintainer, so it hasn't been made here.

## Project policy

| # | Statement | Source |
|---|---|---|
| P1 | Educational use only: not a diagnostic tool and not for diagnosis, treatment planning or clinical decisions | The project's own disclaimer. It also appears in the app footer (`Footer` in `src/ui/Overlays.tsx`) and at the top of `README.md`. |
| P2 | Code MIT | `LICENSE` |
| P3 | Models CC BY-SA 2.1 JP; nerve and vessel paths (`neurovascular.glb`) CC BY-SA 4.0 | Follows from F3 and F7 (share-alike). See `CREDITS.md` and `docs/assets.md`. |
| P4 | Text CC BY-SA 4.0 | `README.md` ("Licence" section) and `docs/content.md` (contribution rule 4) |
| P5 | Text marked as an unreviewed draft is pending expert review | `docs/content.md` ("Status and verification"). The status comes from `src/content/content.ts`. |

## Project description (checked against the code)

| # | Statement | Where it is implemented |
|---|---|---|
| D1 | Open-source, interactive 3D explorer of dental anatomy, from the whole mouth down to the pulp and root canals of a single tooth | App: `src/engine`, `src/ui`. Licence: `LICENSE`. Pulp and canals: `src/anatomy/registry.ts` (tooth layers) and the 5 dissection levels in `src/state/store.ts` (`DISSECT_LEVELS`). |
| D2 | *(Removed.)* The details panel no longer shows a provenance or review-status badge; the About dialog no longer claims it does. Provenance is still described in About (F1–F6) and recorded per mesh in `manifest.json`. | — |
| D3 | Controls: drag to orbit, right-drag to pan, scroll to zoom, click to select, double-click to focus. On touch: one finger orbits, two fingers pan, pinch zooms. | `src/engine/camera.ts` creates three.js OrbitControls and keeps its default bindings: left-drag rotates, right-drag pans, the wheel zooms, one finger rotates, and two fingers zoom and pan. `src/engine/Engine.ts` selects on `pointerup` and focuses on `dblclick`. |
| D4 | Keyboard shortcuts (`/`, `Esc`, `F`, `I`, `H`, `G`, `D`, `[` `]`, `E`, `C`, `L`, arrows, `+` `−`, `R`) | `src/ui/useKeyboard.ts` handles every listed key, and the action it runs matches the dialog. `E` separates the tooth layers when you are inside a tooth, and otherwise dissects the arch. |
| D5 | Orbit mode. Fixed: always turn around the model centre. Free: pan and focus move the pivot. | `src/engine/camera.ts` (`CameraRig.setMode`, `tick`, `fixedFocusPose`) and `src/engine/Engine.ts` (`updatePivot`: the pivot is the dentition, or the tooth being dissected). The switch is in `src/ui/CameraControls.tsx`. |


## Dental feedback additions (2026-10-04)

The earlier F6 schematic inventory and F8 atlas inventory are extended by `cranial.py` and `manifest.json`. Dental nerve and vessel atlas paths are retained, including the full sampled CN V root. New V1, VII (five terminal branch groups), IX, X and XII paths, additional skull-exit markers and TMJ movement are schematic teaching examples. This is stated in all five About translations. It does not assert that every cranial branch or all paranasal sinuses are modeled. Citations, canal count definitions, geometry limits and pending dental review are listed in [feedback-anatomy.md](feedback-anatomy.md).
