# Contributing to Dental Scope

Thanks for helping build an open dental anatomy explorer. Contributions of code, anatomy content, verified text, 3D data and bug reports are all welcome.

## Getting started

```bash
git clone https://github.com/Yoosseph/dental-scope
cd dental-scope
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (Vitest)
npm run typecheck
```

The production models are committed in `public/models/`, so you don't need the asset pipeline to work on the app.

## Project layout

See [docs/architecture.md](docs/architecture.md). In short:

- `src/app` — routing, search/sharing metadata, repository link.
- `src/anatomy` — structure registry, tooth tables, notation. **Add anatomy here, not in components.**
- `src/content` — educational text (JSON).
- `src/search` — search index and scorer.
- `src/engine` — Three.js engine (no React).
- `src/state` — store and the visibility resolver.
- `src/ui` — React components.
- `src/modes` — scaffolds for Learn / Quiz / Compare (not wired up yet).
- `tools/pipeline` — Python + Node asset pipeline.

## Guidelines

- **Keep React out of the render loop.** Anything per-frame belongs in `src/engine`.
- **No hardcoded structure IDs in UI.** Read them from the registry.
- **Be honest about data.** New geometry must carry a provenance (`source`, `derived`, `modeled`, `schematic`) and new text a status (see [docs/content.md](docs/content.md)).
- **Licences.** Only add 3D data with a licence that allows redistribution and modification. Record it in `docs/assets.md` and `CREDITS.md`. Never add assets taken from other apps or websites.
- **Accessibility.** Every control needs a label and keyboard access; respect `prefers-reduced-motion`.
- **Small commits** with clear messages (`feat(engine): …`, `fix(ui): …`, `content: …`).

## Content contributions

Dental professionals and educators: the most valuable contribution is reviewing the draft text in `src/content/en/`. Follow the checklist in [docs/content.md](docs/content.md) and include your sources.

## Asset pipeline

```bash
pip install -r tools/pipeline/requirements.txt
npm run assets:fetch
npm run assets:build
npm run assets:compress
node tools/gen-assets-doc.mjs
```

## Reporting issues

Please include browser, device, steps to reproduce and a screenshot. For anatomical errors, cite a reference.

## Code of conduct

Be kind, assume good faith, and keep discussion focused on making dental education better.
