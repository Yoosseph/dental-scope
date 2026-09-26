# Educational content

Text lives in `src/content/en/*.json`, separate from anatomy data and UI.

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
