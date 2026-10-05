# TODOs from dental feedback

Captured 2026-10-04. This backlog translates the Swedish feedback into actionable work, checked against the current code. The order below is a suggested implementation order. Implemented for server review on `codex/dental-feedback`. Sources and model scope are recorded in [feedback-anatomy.md](feedback-anatomy.md); professional dental review remains pending.

## Already available

- [x] Temporalis, masseter, buccinator, orbicularis oris, medial pterygoid and both heads of lateral pterygoid are registered and included in the asset pipeline. See [structures.ts](../src/anatomy/structures.ts) and [build_assets.py](../tools/pipeline/build_assets.py).
- [x] Whole layers can be made translucent, and individual structures can be ghosted. See [LayersPanel.tsx](../src/ui/LayersPanel.tsx) and [DetailPanel.tsx](../src/ui/DetailPanel.tsx). Whether these controls are easy to discover remains a follow-up below.
- [x] Inferior alveolar and mental nerves, plus mandibular and mental foramina, are selectable. The foramina are landmarks; this does not establish that the bone meshes contain accurate openings.
- [x] The original partial trigeminal anatomy contained: the ganglion region, V2, V3 and several dental branches. The feedback implementation now retains the full sampled root and adds V1; small terminal branches remain simplified.

## 1. Swedish sinus terminology — small content change

- [x] Use **Bihålor** for the Swedish layer label and **Bihåla i överkäken (sinus maxillaris)**, with appropriate singular/plural forms, for the specific structures. Keep the wording specific to the maxillary sinuses so it does not imply that all paranasal sinuses are modeled.
- [x] Update Swedish educational text, About text and generated guide-page terminology consistently. Keep `käkhåla` and its inflections as search aliases.
- [x] Check resulting Swedish guide URLs; preserve existing public links if translated slugs change.

Done when the Swedish UI and content use the agreed terminology, both old and new terms find the structures, and existing links still work.

Starting points: [sv.ts](../src/i18n/sv.ts), [anatomy.ts](../src/i18n/anatomy.ts), [Swedish structures](../src/content/sv/structures.json), [Swedish teeth](../src/content/sv/teeth.json), [about-text.ts](../src/app/about-text.ts), [guide.ts](../src/app/guide.ts).

## 2. Make existing transparency and muscles easier to find — UI follow-up

- [x] Review the translucent-layer and selected-structure controls on desktop and mobile; improve labels or add a short contextual hint where needed.
- [x] Add a nerve-and-muscle view preset that shows nerves clearly with relevant muscles and bone translucent. Reuse the existing visibility controls.
- [x] Verify that a user can select a nerve, reveal its surrounding muscles and see its course through ghosted bone without losing selection or camera focus.

Done when the nerve-and-muscle relationship can be reached through an obvious control and inspected on desktop and mobile.

Starting points: [categories.ts](../src/anatomy/categories.ts), [LayersPanel.tsx](../src/ui/LayersPanel.tsx), [DetailPanel.tsx](../src/ui/DetailPanel.tsx), [visibility.ts](../src/state/visibility.ts).

## 3. Explain nerve passages and foramina — anatomy and presentation

- [x] Expand the explanations linking **n. alveolaris inferior → foramen mandibulae → mandibular canal** and **n. mentalis → foramen mentale**, with navigation in both directions between nerves and passages.
- [x] Verify the feedback's suggested relationship of the mental foramen to the lower premolars ("4 and 5"); describe typical location and variation with cited sources rather than treating one location as universal.
- [x] Inspect the current landmark positions and bone meshes. Decide where existing markers suffice and where actual canal/opening geometry needs to be added or corrected.
- [x] Make the passages easy to focus on and label, with nearby tooth references and a useful camera view. Retain Latin names alongside localized names.
- [x] Include the existing infraorbital foramen in the same presentation; assess further skull-base passages alongside the cranial-nerve expansion.

Done when users can follow each initial nerve route, identify its named entry/exit, and understand how the displayed example relates to anatomical variation. Record provenance for any added geometry.

Starting points: [structures.ts](../src/anatomy/structures.ts), [content](../src/content/content.ts), [labelPoint.ts](../src/engine/labelPoint.ts), [asset pipeline](../tools/pipeline/build_assets.py).

## 4. Canal-count frequencies by tooth type — research before UI

- [x] Find suitable studies or systematic reviews for all 16 permanent tooth types. Record citation, population, sample size, method and the definition of canal count.
- [x] Distinguish **number of roots**, **number of canals** and **canal configuration**; do not combine incompatible measurements into one percentage table.
- [x] Add structured, sourced frequency data, using ranges or separate population estimates where appropriate. Explicitly leave unsupported entries unavailable.
- [x] Show frequencies in tooth details and guide pages, explaining that the current 3D tooth depicts one modeled configuration rather than every variant.
- [x] Carry the presentation into all five languages, retaining draft status until dental review.

Done when every published percentage is traceable to a source and its definition, and no modeled example is presented as a universal configuration.

Starting points: [tooth content](../src/content/en/teeth.json), [content resolver](../src/content/content.ts), [DetailPanel.tsx](../src/ui/DetailPanel.tsx), [guide.ts](../src/app/guide.ts), [content review policy](content.md).

## 5. Expand cranial nerves — new assets and anatomical scope

- [x] Define the educational extent of **n. trigeminus (V)**: root, ganglion, V1/V2/V3 and the relevant branches and skull exits. Audit what can be retained from the current model.
- [x] Add **n. facialis (VII)** and relevant branches, showing its relationship to the facial muscles already present.
- [x] Add **n. hypoglossus (XII)**.
- [x] Add **n. glossopharyngeus (IX)**.
- [x] Add **n. vagus (X)** within a clearly defined head/neck extent.
- [x] Audit redistributable geometry and retain available atlas paths; add researched schematic courses within the approved scope. Integrate loading/search/labels/content, provenance and credits, with supporting passages. Anatomical review is listed below.

Done when each included nerve has a verified, clearly scoped course, useful surrounding anatomy and translated educational content. Prioritize V and VII first; estimate the remaining nerves after the asset audit.

Starting points: [atlas extraction](../tools/pipeline/extract_z_anatomy.py), [asset build](../tools/pipeline/build_assets.py), [registry](../src/anatomy/registry.ts), [assets documentation](assets.md), [credits](../CREDITS.md).

## 6. TMJ movement — separate animation feature

- [x] Research an opening/closing motion plan covering condylar rotation and translation, the disc and articular eminence. Use an explicitly illustrative motion path, pending dental review.
- [x] Audit whether the current condyle, fossa and schematic disc geometry can support the motion; identify necessary asset corrections.
- [x] Animate opening/closing with play, pause, scrub and reset controls. Move the lower dentition and attached structures consistently with the mandible.
- [x] Show the pterygoid muscles in relation to the moving joint, with illustrative attachment and deformation behavior; review is listed below.
- [x] Support a focused joint view, transparent surrounding anatomy, labels and reduced-motion preferences. Check interactions with dissection, sections and camera controls.

Done when the animation demonstrates a reviewed educational motion, the disc and attached anatomy behave consistently, and users can inspect any point without autoplay.

Starting points: [Engine.ts](../src/engine/Engine.ts), [animator.ts](../src/engine/animator.ts), [TMJ structures](../src/anatomy/structures.ts), [asset pipeline](../tools/pipeline/build_assets.py).


## Review still required

All engineering items above are implemented. References were researched, but the review portions of sections 4–6 are not claimed complete. The user approved atlas plus schematic additions; measured canal walls and a complete cranial-nerve atlas are outside that agreed implementation.

- [ ] Dental review of translated statistics, nerve courses, landmark coordinates and illustrative joint/muscle behavior.
- [ ] User server review using [the review checklist](feedback-anatomy.md#server-review-checklist).
- [ ] User decision on merging; no merge has been performed.

## Follow-up student feedback — 2026-10-05

This batch records the new Swedish feedback. The completed items above belong to the earlier feedback batch.

### Owner's implementation scope — confirmed 2026-10-05

Work in this order: tooth morphology/appearance with optional anatomical labels and overlays, then the remaining sinuses, then vessel visibility and inspection. Include the labels and overlays in the current scope, while prioritizing sharp, anatomically appropriate shapes and tooth-specific patterns over cosmetic sharpening. Quiz/self-test and contributor credits are deferred and excluded from this implementation. The existing development feature retains its review/documentation follow-ups. New anatomical content and fitted teaching geometry remain draft until expert review.

### Assessment against the current project

- **All paranasal sinuses:** valid scope gap. The registry and asset pipeline currently include only the left/right maxillary sinuses. The other groups are the frontal sinuses, sphenoidal sinuses and ethmoidal air cells; the ethmoid component should not be represented as one simple cavity. See [StatPearls: Nose Paranasal Sinuses](https://www.ncbi.nlm.nih.gov/books/NBK499826/?report=reader).
- **Early teaching relevance:** reasonable educational motivation. The exact claim that these topics are taught in years 1–2 depends on the student's programme; it has not been independently verified against a specific syllabus. The maxillary sinus's relationship to the upper teeth supports retaining the current dental focus alongside the broader anatomy. See [University of Baghdad dental teaching material: Paranasal Sinuses](https://codental.uobaghdad.edu.iq/wp-content/uploads/sites/14/2023/01/The-paranasal-sinus-final-2-1-Dr.Farah-Alsalman.pdf).
- **Tooth development and eruption:** positive feedback about an existing feature, rather than a missing-feature request. The project already has primary/mixed/permanent dentition snapshots and eruption ranges. Its geometry and transitions are schematic, with draft content pending expert review; see [dentition-development.md](dentition-development.md). [AAPD Dental Growth and Development](https://www.aapd.org/globalassets/media/policies_guidelines/r_dentalgrowth25.pdf) supports the timing content and explicitly acknowledges variation.
- **Arteries and veins in 3D:** valid learning goal, but these are already registered, generated and described. Existing arteries include external carotid, maxillary, inferior alveolar, posterior superior alveolar, descending palatine, buccal and facial arteries. Existing veins include inferior alveolar, maxillary, retromandibular, facial and internal jugular veins, plus the pterygoid venous plexus. Most paths are atlas-derived; the inferior alveolar vein and pterygoid plexus are schematic. Treat this as a discoverability/course-and-relationships audit before deciding on additional vessels. Their dental relevance is supported by [StatPearls: Maxillary Artery](https://www.ncbi.nlm.nih.gov/books/NBK542301/?report=reader).

### 7. Expand the paranasal sinus anatomy — suggested priority: high

- [ ] Define an introductory scope covering maxillary, frontal and sphenoidal sinuses and ethmoidal air cells. Confirm the intended course coverage with a dental educator; do not assume one universal year-by-year syllabus.
- [ ] Audit available licensed geometry and the surrounding skull/nasal anatomy. Record which paths can use source/atlas geometry and which would require explicitly schematic models; account for anatomical variation and avoid implying patient-specific accuracy.
- [ ] Plan selectable frontal and sphenoidal sinuses and ethmoidal air-cell groups alongside the existing maxillary sinuses, with useful views of their relationships to the nasal cavity, orbit and skull base. Retain the maxillary sinus relationship to the upper posterior teeth.
- [ ] Plan consistent layer labels, localized names, Latin terminology, search aliases and related-structure navigation so users can distinguish all sinus groups.
- [ ] Before implementation is considered complete, supply meaningful descriptions for every new named structure/atlas part in English, Swedish, German, Spanish and Latin, including location, relationships and relevant function. Cite medical sources, document asset provenance/licensing and keep content draft until expert review.
- [ ] During eventual implementation, run description coverage tests and the production build, and review selection, labels, transparency and camera views on desktop and mobile.

Done when all four sinus groups can be found and inspected in context, with sourced multilingual content and an explicit statement of model limitations. Expert anatomical review is required before claiming reviewed accuracy.

Starting points: [structures.ts](../src/anatomy/structures.ts), [categories.ts](../src/anatomy/categories.ts), [sinus.py](../tools/pipeline/sinus.py), [build_assets.py](../tools/pipeline/build_assets.py), [content policy](content.md), [assets documentation](assets.md).

### 8. Make vessel courses and relationships easier to inspect — suggested priority: high

- [ ] Reproduce the student's experience on the reviewed deployment and compare it with the current repository. Check whether the existing neurovascular assets load and whether artery/vein layers, search and structure selection are discoverable. The cause of the apparent omission is not yet established.
- [ ] Audit the existing vessel paths and descriptions against sources, especially their relationship to jaws, teeth, nerves and pterygoid muscles. Record simplifications, missing connections and any genuine coverage gaps before proposing new geometry.
- [ ] Plan an obvious vessel-focused view using the existing visibility controls: arteries and veins visible, surrounding bone/muscles translucent, with teeth and nerves available as context. Check that users can follow a selected vessel without losing anatomical orientation.
- [ ] Review artery/vein identification, labels, focus and related-structure links on desktop and mobile; ensure the atlas versus schematic distinction remains visible.
- [ ] If the audit identifies missing vessels or branches needed for the agreed teaching scope, document a separate sourced expansion proposal with licensed geometry, five-language descriptions and draft/expert-review requirements. Do not add a duplicate vessel system.
- [ ] During eventual anatomy/content-resolution changes, run description coverage tests and the production build; verify vessel selection and surrounding-layer visibility together.

Done when a learner can find an artery or vein, follow its displayed course and inspect nearby anatomy, with the audit documenting any remaining coverage limits.

Starting points: [vascular registry](../src/anatomy/structures.ts), [layer presets](../src/anatomy/categories.ts), [LayersPanel.tsx](../src/ui/LayersPanel.tsx), [DetailPanel.tsx](../src/ui/DetailPanel.tsx), [asset pipeline](../tools/pipeline/build_assets.py), [assets documentation](assets.md).

### 9. Preserve and review tooth-development teaching — suggested priority: medium

- [ ] Include the existing timeline and eruption information in educator/student review, preserving the feature the student found useful.
- [ ] Review primary and permanent eruption ranges, sequence and succession against the cited sources. Keep timing ranges and normal variation clear, and distinguish eruption from calcification, root completion and the representative age snapshots.
- [ ] Check that the schematic geometry/motion disclaimer and draft status are understandable in all five languages; avoid presenting the timeline as an individual child's measured growth or dental-age assessment.
- [ ] Update the README's stale unchecked "Primary dentition and an eruption timeline" roadmap item to reflect the feature that already exists and its remaining review limitations.

Done when the existing feature's educational value and limitations have been reviewed and its documentation reflects the current implementation. This feedback alone does not request additional development stages or a new animation.

## Additional student conversation — captured 2026-10-05

The supplied conversation requests more readable tooth morphology. The owner has deferred both the self-test and contributor credits and removed them from the active implementation scope. These TODOs supplement sections 7–9. The implementation and remaining external review are recorded below.

The central learning goal is recognizing an isolated tooth's type, arch and side from multiple surfaces and its roots. "Sharper teeth" alone is not an adequate specification: the student asks for recognizable anatomical features and more realistic models. The BoneBox comparison is the student's reported experience, not an independently verified comparison. The owner subsequently supplied three images, recorded below, and a screenshot identifying [Doctoropsy (@doctoropsyindia)](https://www.youtube.com/@doctoropsyindia). A relevant channel video was found: [Permanent Maxillary Canine](https://www.youtube.com/watch?v=rui02HbcEt8), covering labial, lingual, mesial, distal and incisal morphology. Use these teaching references alongside medical sources, rather than treating visual screenshots as measured anatomy.

The project already has tooth/enamel shading that emphasizes existing concavities (`toothShading.ts`), isolated-tooth controls and an anatomy-board layout. Audit these existing features before deciding which improvements remain necessary.

### Supplied visual references

These images are preserved as feedback references, not production assets or verified anatomical sources. The image observations below describe visible appearance only; validate anatomical names and feature placement with medical sources and an educator before modeling or labeling them.

| Reference | What the image makes clear | Implication for the model review |
| --- | --- | --- |
| [Image 1: BoneBox upper right first molar](references/student-feedback-2026-10-05/bonebox-upper-right-first-molar.png) | Occlusal view with distinct raised cusp volumes, depressions and branching grooves. Highlights and darker recesses help the surface relief read. | Check that the crown's elevations and depressions remain distinguishable at normal zoom; assess geometry and lighting together. This view does not establish full root anatomy. |
| [Image 2: BoneBox upper right canine](references/student-feedback-2026-10-05/bonebox-upper-right-canine.png) | An oblique view of the crown's inner surface shows raised ridges and recessed areas, a distinct outline, and a tapered root. Crown and root differ visibly in color and surface finish. | Review canine surface relief, silhouette and crown/root differentiation as well as posterior biting surfaces; confirm orientation and named features during anatomical review. |
| [Image 3: Primary Grooves teaching graphic](references/student-feedback-2026-10-05/primary-grooves-reference.png) | Colored groove paths with leader labels for central, buccal, lingual and distal oblique grooves. | Consider an optional surface-feature overlay that follows actual geometry and explains each reviewed feature. The graphic's source and exact tooth identity are unconfirmed; do not apply its labels or groove pattern to every tooth. |

### 10. Improve tooth morphology for identification — suggested priority: high

- [ ] Review relevant tooth-morphology videos from the supplied Doctoropsy channel, and establish the source/tooth identity of the Primary Grooves graphic. Use the supplied screenshots as visual comparison references; audit source/licensing before proposing any reusable assets.
- [ ] With a dental educator, create a sourced morphology checklist for each permanent tooth type in both arches, including side-identification cues and normal variation. Use the student's requested categories: cusps, grooves/fissures, fossae, ridges, crown outline/proportions, mesial/distal differences and root shape/length; distinguish anterior, canine and posterior teaching needs.
- [ ] Audit current models from occlusal/incisal, buccal/labial, lingual/palatal, mesial and distal views, including full roots. Record missing geometry separately from features that exist but are hard to see because of lighting, shading, selection highlights or camera framing.
- [ ] Compare source and shipped tooth meshes to determine whether source detail, mesh simplification or generated outer enamel surfaces limit readability. Record evidence before choosing changes; include the derived third-molar models and approximate primary-tooth models where relevant to teaching scope.
- [ ] Plan geometry refinements or replacement assets only where the audit finds insufficient morphology. Use Image 1 to guide review of molar cusp separation, groove continuity and depression depth, and Image 2 to guide review of canine inner-surface relief, crown outline and root taper. Retain provenance/licensing and distinguish representative teaching models from measured anatomy; avoid arbitrary sharpening or one supposedly universal pattern.
- [ ] Plan material/lighting refinements that reduce the reported plastic appearance and make existing features readable at normal study zoom on desktop/mobile. Evaluate the current crevice shading, crown/root color transition and surface finish against Images 1–2. Check that bright highlights do not wash out ridges and depressions; keep crown shape and anatomical detail as the acceptance criteria.
- [ ] Plan optional named surface-feature labels/highlights within the existing registry/content architecture where they help identification. Use Image 3 as a presentation reference for colored paths and leader labels, with overlays that can be switched off to inspect the tooth surface. Confirm each label and placement for the specific tooth with sources. Every newly selectable named feature must have meaningful sourced descriptions in English, Swedish, German, Spanish and Latin, with draft status until expert review.
- [ ] Verify eventual geometry changes remain consistent with internal tooth layers, sections, dissection and selection, and preserve useful loading/rendering performance. Run description coverage tests and the production build when anatomy/content resolution changes.
- [ ] Arrange a student/educator comparison of the revised models against the checklist and supplied references at comparable viewing angles and zoom. Confirm that surface features and roots can be inspected clearly from multiple views using the existing tooth viewer.

Done when reviewers can locate the agreed features and use them to distinguish tooth type, arch and side from multiple surfaces, with documented variation and reviewed anatomical content. Cosmetic sharpness alone does not satisfy this requirement.

Starting points: [asset pipeline](../tools/pipeline/build_assets.py), [tooth layers](../tools/pipeline/tooth_layers.py), [tooth shading](../src/engine/toothShading.ts), [materials](../src/engine/materials.ts), [board layout](../src/engine/layout.ts), [DetailPanel.tsx](../src/ui/DetailPanel.tsx), [assets documentation](assets.md).

### 11. Follow-up review — suggested priority: medium

- [ ] Prepare a 20–40 minute review checklist covering model readability, isolated-tooth recognition and the earlier sinus/vessel/development feedback; record findings against the tested deployment/version. Arrange follow-up with the student when the owner authorizes contact.

Contributor credits and self-testing are deferred by the owner. No contributor section, public names or new credit links are included in this implementation.


## Implementation status — student batch, 2026-10-05

The owner authorized implementation after planning. Engineering work for sections 7–10 is now implemented locally; the original compound checkboxes above remain a record of acceptance/review requirements, including external review that has not occurred. See [the implementation report and 30-minute checklist](student-feedback-implementation.md) for sources, reproducible generation, scope limits and validation.

- [x] Refine all 32 permanent tooth shells and crown tissues with tooth-specific teaching relief, preserve source roots, improve study lighting/materials, and provide five surface views.
- [x] Add optional fitted paths and selectable surface landmarks with sourced descriptions/names in all five languages; retain draft/schematic status.
- [x] Add bilateral frontal/sphenoidal teaching volumes and separated ethmoidal air-cell groups; keep the maxillary volumes and dental relationships. Add an all-sinuses preset, search/labels, group/side controls and transparent context.
- [x] Audit the existing 14 artery and 12 vein meshes, cite their course descriptions, and add a vessel preset with full regional-trunk visibility, type/side filters, selection and relationships.
- [x] Check development timing/limitations against AAPD, retain the timeline and update the README roadmap.
- [x] Prepare the follow-up review checklist, without contacting anyone.
- [x] Run five-language description coverage, unit tests, TypeScript/production build, shipped-mesh validation and desktop/compact browser checks.
- [ ] Educator review of anatomical detail, fitted placements, all translations and intended programme coverage.
- [ ] Student comparison of tooth recognition/readability against the supplied references.
- [ ] Establish the original Primary Grooves graphic's source/tooth identity; it was not used as a verified asset or universal pattern.
- [x] Read-only comparison with the linked dental-scope.com deployment: existing vessel entries/selection confirmed, with no vessel or sinus study preset.
- [ ] Confirm the exact historical deployment version if needed for the student's original report.
- [x] Owner authorized committing this implementation. No deployment has been performed; anatomical/student review remains pending.

Quiz/self-test and contributor credits remain excluded.
