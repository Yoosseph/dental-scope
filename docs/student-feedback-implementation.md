# Student feedback implementation — 2026-10-05

> Follow-up: all ethmoidal air-cell teaching clusters and selectable entries have been removed at the owner’s request. The ethmoid bone remains. Earlier four-group descriptions below record the initial implementation. See `tooth-visualization-review.md` for the subsequent crown/material revision.

Implemented locally and subsequently authorized for commit by the owner; no deployment, educator endorsement or student follow-up is implied. Quiz/self-test and contributor credits are excluded. The original screenshots remain reference material, not production assets.

## Tooth morphology and appearance

The shipped intact shells originally retained more source detail than the generated outer enamel. The layered view therefore lost some of the source crown relief. Existing lighting also left downward-facing maxillary biting surfaces in shadow. The update fits the enamel exterior toward the source, adds tooth-specific teaching relief, reduces noisy material variation, and supplies a camera-facing study light inside isolated teeth. Root vertices below the modeled cervical line remain unchanged before simplification/compression. Source crown outlines, arch positions, asymmetric roots and relative proportions are retained; this is refinement of the existing atlas, not a replacement scan dataset.

The same continuous crown deformation is applied to enamel, dentin, pulp and their landmarks so the relief remains coherent in sections and dissection. Inner tissues remain modeled teaching geometry. All 32 permanent teeth have optional fitted surface landmarks; paths follow the crown surface and move with its tissue during layer separation. Turn them off to inspect the uncolored model. Dedicated biting/incisal, facial, inner, mesial and distal views use each tooth's frame.

| Tooth family | Teaching features and distinctions to review |
| --- | --- |
| Incisors | Incisal edge, cingulum, lingual fossa, marginal ridges; upper/lower relief differs. Compare central/lateral crown outlines and mesial/distal angles in the retained source. |
| Canines | Cusp tip, cingulum, labial and lingual ridges, two lingual fossae and marginal ridges; lower inner relief is less pronounced. Check cusp slopes, crown/root outline and side cues in the source. |
| Upper premolars | Buccal/palatal cusps, buccal ridge, central groove, mesial/distal fossae and marginal ridges. First-premolar groove extends farther and its facial ridge is stronger than second in the teaching pattern. |
| Lower first premolars | Small lingual cusp, dominant buccal cusp, buccal ridge, transverse ridge, mesiolingual groove and separate mesial/distal fossae; no generic molar-style central cross. |
| Lower second premolars | Representative two-cusp form. Three-cusp/Y variants are not separately modeled; do not teach this example as universal. |
| Upper molars | Four principal cusps, oblique ridge, central/buccal/lingual/distal-oblique grooves and fossae. Source first/second crown outlines differ. Carabelli and reduced-cusp variants are not separately supplied. |
| Lower first molars | Representative five-cusp pattern, including distal cusp and two buccal grooves. |
| Lower second molars | Representative four-cusp cross pattern. Individual groove/cusp variants remain outside this example. |
| Third molars | Existing second-molar-derived shells retained, with teaching relief; no claim of a unique or measured third-molar morphology. |

Sources: [US Air Force Dental Laboratory manual, chapter 4](https://dentaltechnology.org/en/reference-library/air-force-dental-laboratory-manual/volume-1/chapter-04.md), [Permanent Maxillary and Mandibular Premolar Teeth](https://www.intechopen.com/chapters/62386), [Dental Anatomy and Morphology of Permanent Teeth](https://www.intechopen.com/chapters/86255), [Doctoropsy: Permanent Maxillary Canine](https://www.youtube.com/watch?v=rui02HbcEt8), and [mandibular molar groove-pattern variation](https://pubmed.ncbi.nlm.nih.gov/15160211/). These support anatomical patterns, not the chosen displacement coefficients or fitted coordinates. The exact source/tooth identity of the supplied Primary Grooves graphic remains unconfirmed; no asset or universal template was copied from it.

## Sinuses

The registry now groups maxillary, frontal and sphenoidal sinuses and ethmoidal air cells under Paranasal sinuses. The Sinuses preset opens transparent skull/jaw context, translated group buttons and side-specific selection. Search, labels, details and related structures use the existing registry/content architecture.

No segmented frontal/sphenoid/ethmoid air-cavity assets are available in the bundled source pipeline. The six added meshes are original **schematic regional teaching volumes**, located using the source skull's frontal, sphenoid and ethmoid regions and anatomical relationships. They are not cavities extracted from those bones. Frontal and sphenoidal examples are smooth volumes; each ethmoidal group contains eight separate illustrative cells rather than one chamber. Number, septation, sizes, ostia, mucosa and drainage pathways are not reconstructed. These models cannot establish wall thickness, neurovascular clearance or surgical landmarks. The existing fitted maxillary volumes and upper-tooth relationships are retained.

[StatPearls: Nose Paranasal Sinuses](https://www.ncbi.nlm.nih.gov/sites/books/NBK499826/) supports the four groups and their relationships. Original new schematic geometry accompanies the existing BodyParts3D-derived distribution; no third-party illustration or mesh has been imported. Medical sources are cited and paraphrased, not redistributed as artwork. New descriptions/names are supplied in English, Swedish, German, Spanish and Latin, with draft status.

## Vessel audit and inspection

The repository already contained 14 artery and 12 vein meshes. The omission reported by the student could not be reproduced as missing assets locally. Regional trunks were deliberately pale, translucent and unlabelled; they are now fully visible and selectable in the Vessels preset. The preset makes bone/muscle translucent and provides artery/vein and side filters, a vessel selector, labels, focus, details and related structures. Selecting a vessel through search relaxes conflicting study filters. Arteries remain red and veins blue; selection lightens the vessel without changing an artery to the vein color.

Atlas-derived courses include external carotid, maxillary, inferior alveolar, posterior superior alveolar, descending palatine, buccal and facial arteries, and maxillary, retromandibular, facial and upper internal jugular veins. Inferior alveolar veins and the pterygoid plexus are schematic. Source paths are unchanged. The anterior retromandibular division and upper jugular extent are incomplete regional examples; small branches, full venous anastomoses, flow and valves are not simulated. No duplicate vascular system or new vessel is added. The conversation links https://dental-scope.com/. A read-only browser comparison on 2026-10-05 confirmed that the current live site has 14 artery and 12 vein entries, a working maxillary-artery details route, only two maxillary sinus entries, and no vessel/sinus study presets. Its selected maxillary artery is obscured by opaque muscles and other anatomy in the default view. That supports a discoverability/visibility problem rather than a missing vessel system in the current deployment; the exact historical version seen by the student is unknown.

Vessel descriptions now link their sources: [Maxillary Artery](https://www.ncbi.nlm.nih.gov/sites/books/NBK542301/), [Pterygoid Plexus](https://www.ncbi.nlm.nih.gov/sites/books/NBK555896/), [Facial Artery](https://www.ncbi.nlm.nih.gov/books/NBK536932/), [Carotid Arteries](https://www.ncbi.nlm.nih.gov/books/NBK545238/) and [Internal Jugular Vein](https://www.ncbi.nlm.nih.gov/books/NBK513258/). These describe relationships; atlas registration and schematic placements still need expert review. No additional vessel is required to expose the agreed existing dental scope.

## Development

The timeline remains present. Timing ranges were checked against [AAPD Dental Growth and Development](https://www.aapd.org/globalassets/media/policies_guidelines/r_dentalgrowth25.pdf). Eruption ranges are separate from calcification onset and illustrative stage ages. Primary successor removal and incomplete-root geometry are display conventions rather than physiological resorption. Variation and draft/schematic limitations are available in all five languages; see [dentition-development.md](dentition-development.md). The README now marks the existing timeline as implemented with expert review pending.

## Reproduction and engineering verification

`build_assets.py` includes the crown and sinus generation for future complete rebuilds. The targeted refresh scripts rebuild only affected shipped files; they require the source STLs and cached tooth layers. Run from the repository root:

```text
python tools/pipeline/refresh_morphology.py --bp3d tools/pipeline/raw/stl --out tools/pipeline/.cache/morphology
node tools/pipeline/refresh_morphology.mjs tools/pipeline/.cache/morphology
python tools/pipeline/refresh_sinuses.py
node tools/pipeline/refresh_sinuses.mjs
node tools/pipeline/validate_study_assets.mjs
npm test
npm run build
```

The generator asserts unchanged source root vertices and valid closed shell/enamel solids for all 32 teeth. The refined core asset is approximately 2.3 MB; tooth assets average approximately 367 KB. This increases download size to preserve readable crown/tissue detail; assets remain streamed per tooth. Browser responsiveness was checked locally at desktop and phone viewport sizes, not benchmarked on physical low-end devices.

Shipped-asset validation decodes Meshopt and checks mesh names, finite positions, triangle counts, bounds and manifest file sizes. Content coverage checks every selectable description in every language. Study tests cover tooth-family differences, draft/source coverage, bilateral sinus registration, transparent skull selection, mode switching, vessel filtering and reveal behavior. Browser checks cover isolated tooth relief/overlays, sinus and vessel selection, dissection/sections and compact controls. These are engineering checks, not dental sign-off.

## Owner/student/educator review — 30 minutes

Record deployment URL, date, viewport/device, model ID and viewing angle for every finding. This checklist is prepared; nobody has been contacted.

1. **12 minutes — tooth recognition:** compare upper first molar and upper canine with the supplied references at similar zoom; then upper/lower incisors, both premolar types, first/second molars and derived third molars. Inspect all five surfaces and roots, with overlays on and off. Assess cusp/groove/ridge location, continuity, side cues, silhouette, proportions, material and lighting. Record any feature needing geometry correction separately from unreadable shading or misplaced labels.
2. **5 minutes — layers:** section and separate the same teeth. Check crown/inner-tissue coherence, cervical seams, canal continuity and labels. Repeat one tooth in dark theme and on a phone.
3. **5 minutes — sinuses:** find all four groups in search and the preset; inspect both sides and lateral/superior views. Confirm the teaching volumes lie in appropriate regions and that their limitations are clear. Educator review is required for exact placement and terminology.
4. **5 minutes — vessels:** follow maxillary and inferior alveolar arteries, facial vein and pterygoid plexus. Try one side and each vessel type, then select an opposite-side vessel in search. Check nearby bone/nerve/muscle context and the atlas/schematic distinction.
5. **3 minutes — development:** inspect primary, mixed and permanent snapshots and eruption ranges. Confirm that normal variation, incomplete roots and representative ages are clear. Confirm intended programme coverage with the educator instead of assuming universal year-1/year-2 teaching.

Pending external review: dental anatomy/translation sign-off, student recognition/readability comparison and historical deployment/version confirmation. The owner authorized committing the implementation; anatomical approval remains pending. Keep all new anatomical teaching material draft until that review is complete.
