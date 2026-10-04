# Educational content

Text lives in `src/content/en/*.json`, separate from anatomy data and UI.
Localized additions also live in `src/content/feedbackAnatomy.ts` and `src/content/supportingAnatomy.ts`; both merge into the same resolver.

## Required description coverage

Every selectable registry item must have a meaningful summary in all five languages. New static anatomy parts require their own content key (left/right pairs may share one); generic prefix fallback is not enough. Generated tooth tissues may reuse their tissue description.

`src/content/coverage.test.ts` audits the registry against the current model manifest, and the production build runs the same `descriptionGaps` check. Missing entries or translations fail the build. The rule is also recorded in the repository's `AGENTS.md` for future changes.

The hyoid detail panel includes a sourced, translated attachment diagram in `src/ui/HyoidConnections.tsx`. Its attachment descriptions live in `src/content/hyoidAttachments.ts`. These are schematic explanatory connections, not additional 3D anatomy meshes.

## Files

| File | Keys | Used for |
|---|---|---|
| `teeth.json` | `tooth:<type>:<arch>` e.g. `tooth:first-molar:mandibular` | All 32 teeth (by type and arch) |
| `structures.json` | Structure ID without side/tooth suffix, e.g. `enamel`, `inferior-alveolar-nerve`, `tmj` | Everything else |

The resolver (`src/content/content.ts`) tries the most specific key first and then strips suffixes: `canal-mesial-1-36` → `canal`, `masseter-superficial-right` → `masseter-superficial` → `masseter`.

## Fields

```jsonc
{
  "summary": "One or two sentences.",
  "function": "What it does.",
  "clinical": "Why it matters clinically.",
  "facts": [{ "label": "Composition", "value": "About 96% mineral by weight" }],
  "related": ["dentin-coronal", "cej"],   // structure keys; resolved to the same tooth/side
  // teeth only:
  "roots": "Two (mesial and distal)",
  "canals": "Usually three",
  "eruption": "About 6–7 years"
}
```

## Status and verification

All current text is **draft**: written from standard dental anatomy knowledge. Per-entry status is not wired up yet: `src/content/content.ts` shows every entry as draft, whatever the JSON says (see [architecture.md](architecture.md) §8). Until it is, record reviews in the pull request. Once it is wired up, verify an entry against at least one of these before changing its status to `reviewed`:

- Nelson SJ. *Wheeler’s Dental Anatomy, Physiology and Occlusion* (current edition)
- Scheid RC, Weiss G. *Woelfel’s Dental Anatomy*
- Berkovitz BKB, Holland GR, Moxham BJ. *Oral Anatomy, Histology and Embryology*
- Vertucci FJ. Root canal anatomy of the human permanent teeth. *Oral Surg Oral Med Oral Pathol* 1984;58:589–599 (canal configurations)
- American Dental Association eruption charts (eruption ages)
- *Gray’s Anatomy* / *Terminologia Anatomica* (nerves, vessels, TMJ, naming)

Rules:

1. Don’t invent numbers. If a value varies, say so (“usually”, “about”, “in a notable minority”).
2. Keep clinical text educational, never prescriptive.
3. Cite sources in a `sources` array when you mark an entry `reviewed`.
4. Content is CC BY-SA 4.0; only contribute text you wrote or may license that way.
