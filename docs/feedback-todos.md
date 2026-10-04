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
