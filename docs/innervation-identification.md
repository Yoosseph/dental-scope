# Tooth nerve supply, identification and palatal nerves

A practising dentist who reviewed the site asked for two additions for dental and dental hygiene students:

1. **The nerve that supplies each tooth**, so students know which nerve is blocked when the tooth is numbed.
2. **How to identify a single tooth out of the mouth**: its type, its arch and its side. In early practicals students are handed one tooth and must name it, for example a mandibular first molar by its three buccal and two lingual cusps, and its side by the curve of its roots relative to the cusps.

All text below is **draft** and pending expert review, like the rest of the content (see [content.md](content.md)).

## What was added

| Where | What |
|---|---|
| Tooth details panel | Two sections for every permanent tooth: **Nerve supply** (tooth/pulp, cheek or lip side gum, palatal or tongue side gum, numbing) and **How to identify it** (which tooth, upper or lower, right or left). All five languages. |
| `/about/` pages | The same two sections under each tooth type, in every language. |
| 3D model | Schematic **greater palatine** and **nasopalatine** nerves on both sides, under *Maxillary nerve (V2) branches* and in the dental nerve view. Without them the palatal gum of the upper teeth had no nerve in the model. |
| Content guard | `descriptionGaps` (tests and production build) fails if any `tooth:<type>:<arch>` entry lacks either guide in any language. |

Code: `src/content/toothGuides.ts` (text, labels, sources), `src/content/content.ts` (`ResolvedContent.guides`), `src/ui/DetailPanel.tsx`, `src/app/about.ts`, `tools/pipeline/palatal.py`.

## Sources

The app links the open sources on each tooth. Claims and where they come from:

| Claim | Source |
|---|---|
| Anterior superior alveolar nerve supplies the upper incisors and canine (and premolars); middle superior alveolar nerve adds premolar supply; posterior superior alveolar nerve supplies the molars | StatPearls, *Anatomy, Permanent Dentition* ([NBK570590](https://www.ncbi.nlm.nih.gov/books/NBK570590/)); *Anatomy, Head and Neck: Alveolar Nerve* ([NBK546712](https://www.ncbi.nlm.nih.gov/books/NBK546712/)) |
| The middle superior alveolar nerve is often absent (found in 7 of 19 dissections) | Heasman 1984, *Br J Oral Maxillofac Surg* 22:439 ([PubMed 6239647](https://pubmed.ncbi.nlm.nih.gov/6239647/)) |
| The posterior superior alveolar nerve always supplies the upper first molar; a middle superior alveolar nerve, when present, contributes in 28% | Loetscher & Walton 1988, *Oral Surg Oral Med Oral Pathol* 65:86 ([PubMed 3422401](https://pubmed.ncbi.nlm.nih.gov/3422401/)) |
| A PSA block alone usually anaesthetises the first molar; a small share needs an extra mesial infiltration | Loetscher, Melton & Walton 1988, *JADA* 117:337 ([PubMed 3166477](https://pubmed.ncbi.nlm.nih.gov/3166477/)) |
| Nasopalatine course (sphenopalatine foramen, septum, incisive foramen behind the central incisors); the two nerves join; a nasopalatine block anaesthetises the palatal tissue of the six upper anterior teeth; the greater palatine nerve supplies the palate from the canine back, overlapping the nasopalatine nerve | StatPearls, *Anatomy, Head and Neck, Nasopalatine Nerve* ([NBK538422](https://www.ncbi.nlm.nih.gov/books/NBK538422/)) |
| Greater palatine nerve from the pterygopalatine fossa through the greater palatine canal | StatPearls, *Anatomy, Pterygopalatine Fossa* ([NBK513269](https://www.ncbi.nlm.nih.gov/books/NBK513269/)) |
| Infiltration is usual in the maxilla, blocks in the mandible | StatPearls, *Local Anesthesia Techniques in Dentistry and Oral Surgery* ([NBK580480](https://www.ncbi.nlm.nih.gov/books/NBK580480/)) |
| Inferior alveolar nerve supplies the lower teeth; incisive nerve supplies the incisors, canine and premolars; mental nerve supplies chin and lip | NBK570590; StatPearls, *Anatomy, Head and Neck, Mandibular Nerve* ([NBK507820](https://www.ncbi.nlm.nih.gov/books/NBK507820/)) |
| Buccal nerve supplies the lower buccal gingiva and may reach the molars through retromolar foramina; lingual nerve supplies the lingual mucosa | NBK507820 |
| Inferior alveolar nerve block | StatPearls, *Inferior Alveolar Nerve Block* ([NBK564368](https://www.ncbi.nlm.nih.gov/books/NBK564368/)) |
| Fibres crossing the midline as a cause of incomplete anaesthesia of lower incisors | Rood 1977, *Br J Oral Surg* 15:75 ([PubMed 268219](https://pubmed.ncbi.nlm.nih.gov/268219/)) |
| Infiltration anaesthesia is effective for lower incisors | Jaber et al. 2010, *Br Dent J* 209:E16 ([PubMed 20953168](https://pubmed.ncbi.nlm.nih.gov/20953168/)) |
| Cusp of Carabelli on the mesiopalatal cusp of upper first molars | NBK570590 |
| Identification traits (crown and root form, arch differences, mesial and distal clues) | Standard tooth-morphology teaching: Scheid & Weiss, *Woelfel's Dental Anatomy*; Nelson, *Wheeler's Dental Anatomy, Physiology and Occlusion*. Not available online; to be checked by the reviewer. |

The nerve-supply text describes typical anatomy for teaching. It is not a prescription for any injection technique.

### The side rule

Every "Right or left" entry ends with the same orientation rule, adapted to the arch. Hold the tooth as it sits in the mouth (upper crown down, lower crown up) and look at its lip or cheek side. Mesial on your right means a tooth from the right side of the mouth. This follows from the facial view: a right tooth sits left of the midline as you face the person, so its mesial surface points to your right. Each tooth's entry first gives the clue that finds mesial: incisal angles, root curvature, the mesial concavity of the upper first premolar, the palatal root and Carabelli cusp of upper molars, the distal cusp and root curvature of the lower first molar.

## Palatal nerve geometry

`tools/pipeline/palatal.py` builds both nerves in app coordinates from the model's own landmarks. They are **schematic**: they show relationships and territories, not a measured dissection of this skull.

- **Pterygopalatine fossa** is placed between the atlas maxillary nerve and the top of the atlas descending palatine artery canal.
- **Greater palatine nerve** follows the atlas descending palatine artery (0.9 mm medial to it) down the canal, out of the greater palatine foramen palatal to the second molar, and forward in the palatal groove to the first premolar. Short branches run to the palatal gingiva of 7, 6 and 5.
- **Nasopalatine nerve** runs medially through the sphenopalatine foramen to the nasal septum, then down and forward on it (control points measured 0.7 mm beside this skull's vomer, which deviates to the right), through the incisive canal to the incisive foramen behind 11/21. A fan reaches the palatal gingiva of 1, 2 and 3.

Review images: [paths over the teeth and bones](screenshots/innervation/palatal-paths.jpg), [tooth panel before](screenshots/innervation/before-tooth-36.jpg) and [after](screenshots/innervation/after-tooth-36.jpg), [nasopalatine nerve details](screenshots/innervation/after-nasopalatine.jpg).

Rebuild only these meshes in the shipped assets (Python needs numpy and trimesh; Node uses the repository's dev dependencies):

```bash
python tools/pipeline/refresh_palatal.py --manifest public/models/manifest.json --out tools/pipeline/.cache/palatal.json
node tools/pipeline/refresh_palatal.mjs tools/pipeline/.cache/palatal.json public/models
node tools/gen-assets-doc.mjs
```

A full `npm run assets:build` adds them through `extend_palatal` after the cranial extension.

## For the reviewer

Please check in particular:

- the right/left clues for each tooth, especially the lower central incisor (distal root groove) and the upper second premolar;
- the numbing row: whether "infiltration" versus "block" matches current teaching for each tooth;
- the canine overlap between the nasopalatine and greater palatine nerves;
- the course of the schematic palatal nerves in the 3D view.
