# Dental Scope — Architecture

How the app is organised, how data flows through it, and where to start for common kinds of work. It is written for someone picking up a task cold. Each section is short and links to the detailed docs instead of repeating them.

**Status markers.** ✅ implemented · 🧩 scaffolded (code exists, not wired into the UI) · 🗺 planned (only described here).

Checked against the code on 2026-09-26.

---

## 1. Quick start

| Task | Command | Notes |
|---|---|---|
| Install | `npm install` | Node 22 (as in CI). Nothing else is needed for the app. |
| Run | `npm run dev` | Vite dev server on <http://localhost:5173>. In dev, `window.ds = { registry, engine }` is exposed for debugging. |
| Unit tests | `npm test` | Vitest, `src/**/*.test.ts`, Node environment (no WebGL) |
| Type check | `npm run typecheck` | `tsc -b --noEmit`, strict |
| Build | `npm run build` | Type check, then `vite build` into `dist/`. The SEO plugin also writes `404.html`, the tooth entry pages, `robots.txt` and `sitemap.xml` (§9). |
| Preview a build | `npm run preview` | |
| Rebuild the 3D assets | `pip install -r tools/pipeline/requirements.txt`<br>`npm run assets:fetch && npm run assets:build && npm run assets:compress`<br>`node tools/gen-assets-doc.mjs` | Python 3 with numpy, scipy, scikit-image, trimesh, rtree and fast-simplification. Only needed when geometry changes: `public/models/` is committed. See [assets.md](assets.md). |

Build-time environment variables:

| Variable | Effect |
|---|---|
| `DS_BASE` | Vite `base`. Use `/dental-scope/` for a sub-path. `./` switches deep links to hash URLs (`#/tooth/36`) and skips the tooth entry pages. |
| `DS_SITE_URL` | Absolute public URL. Enables canonical URLs, Open Graph image tags, structured data and `sitemap.xml`. |
| `VITE_DS_REPO_URL` | Links the "Made by Yoseph" credit and the About dialog to the repository. When unset these show as plain text, so a build never advertises a private repository. |
| `VITE_DS_URL=off` | Stop the app from writing to the address bar (for embedding). |

CI (`.github/workflows/ci.yml`) runs typecheck, test and build on pushes and PRs. Vercel deploys `main` to production and every other branch to a preview. `DS_SITE_URL` and `VITE_DS_REPO_URL` come from the Vercel project's environment variables; unknown deep links fall back to the generated `404.html` app shell.

## 2. Principles

1. **The 3D explorer is the product.** One full-bleed canvas, with UI panels floating around it.
2. **Data drives everything.** Anatomy lives in a registry built from the asset manifest and declarative tables. UI components never hardcode structure IDs (see [CONTRIBUTING](../CONTRIBUTING.md)).
3. **React never renders per frame.** An imperative engine owns Three.js. React renders the panels around it and subscribes to coarse state.
4. **Render on demand.** The rAF loop always ticks, but it only renders when something changed.
5. **Load in stages.** First paint needs only the jaws and teeth. Context, nerves and vessels, and per-tooth internal anatomy stream in afterwards.
6. **Be honest about data.** Every structure carries a provenance (`source`, `derived`, `modeled`, `atlas`, `schematic`) and every text entry a review status.

Runtime dependencies are `react`, `react-dom`, `three` and `zustand`, and nothing else.

## 3. Repository map

```
index.html              HTML shell; the SEO plugin injects <head> tags at the <!-- seo: --> marker
vite.config.ts          Vite + Vitest config and the SEO plugin (entry pages, robots, sitemap, 404)
src/
  main.tsx              Entry: restore preferences → WebGL check → load manifest → Registry, Engine,
                        search index → render <App> inside ServicesContext
  app/
    router.ts           Deep links ↔ store (History API, or hash with a relative base); document title
    seo.ts              Page titles, descriptions, head tags, robots/sitemap (shared by build and app)
    repo.ts             Repository URL from VITE_DS_REPO_URL (null = don't link)
  anatomy/
    types.ts            Structure, ToothMeta, Manifest types
    structures.ts       Declarative non-tooth structures (bones, muscles, nerves, TMJ, …)
    registry.ts         Registry: builds the full hierarchy (incl. 32 teeth and their parts) from manifest + tables
    notation.ts         FDI ↔ Universal ↔ Palmer, tooth names
    categories.ts       Layer categories (19, of which primary teeth and salivary glands are 🗺 planned), presets, colours
  content/
    content.ts          Resolve educational text for a structure id (+ review status)
    en/teeth.json, en/structures.json   The text itself (draft)
  search/search.ts      Index builder and scorer
  state/
    store.ts            Zustand store: AppState, initial state, actions, persisted preferences
    visibility.ts       Pure per-mesh visibility resolver + pluggable filters
  engine/
    Engine.ts           Owns renderer, scene, loop, loading, visibility/highlight/explode/section/labels, picking
    camera.ts           CameraRig: OrbitControls, focus tweens, presets, fixed/free orbit
    materials.ts        Tissue palette + shader patch (highlight, cut faces, grain, edges), theme tuning
    explode.ts          Arch- and tooth-level explode offsets (pure)
    layout.ts           Phase-2 "laid out" board packing (pure; see §6 Explode)
    section.ts          Clipping plane + outline
    labels.ts           DOM label layer with decluttering
    assets.ts           Manifest fetch + GLB loader (meshopt)
    animator.ts         Tiny keyed tween driver
  ui/                   React components: App, TopBar, LayersPanel, StructureTree, DetailPanel, Dock
                        (bottom toolbar), CameraControls (orbit, view pictograms / View picker, zoom),
                        SearchPanel, Overlays (About, footer, loading, start hint), icons,
                        useKeyboard, context (ServicesContext)
  modes/modes.ts        🧩 Mode interface, lesson format, quiz picker (not wired to the UI)
  styles/               tokens.css (design tokens: paper and ink, one ultramarine accent, light/dark), app.css
public/
  models/               Production GLBs + manifest.json (CC BY-SA 2.1 JP, derived from BodyParts3D)
  favicon.svg, og-image.png
tools/
  pipeline/             Python + Node asset pipeline (see §7)
  gen-assets-doc.mjs    Regenerates the asset table in docs/assets.md
docs/                   This file, assets, content, sources, research and comparison notes
```

## 4. Startup and routing

1. `main.tsx` calls `restorePreferences()` (numbering, theme, orbit mode from `localStorage`), checks WebGL, then `loadManifest()`.
2. It builds the `Registry` (pure, from the manifest), the `Engine` and the search index, and renders `<App>` with all three in `ServicesContext`.
3. `App` mounts the engine on the stage `<div>`, starts `engine.loadAll()` (staged loading, §7) and `startRouter()`. It sets `data-theme` on `<html>`, installs the keyboard shortcuts (`useKeyboard`) and tells the engine which parts of the canvas are covered by panels (`engine.setInsets`).
4. `startRouter` applies the current URL (select, focus, maybe enter dissection) and then keeps the URL in sync with `selectedId` / `dissectFdi` through `replaceState`. Explicit navigation (search, tree, detail links) calls `pushPath`. `popstate` / `hashchange` re-apply. It also keeps `document.title` in sync.

| URL | Effect |
|---|---|
| `/` | Overview |
| `/tooth/36/` | Select and focus tooth 36 (FDI). The build writes a static entry page here, with its own title. |
| `/tooth/36/dissect` | Open the dissection of tooth 36 |
| `/structure/<id>` | Select and focus any structure (served through the `noindex` 404.html shell on static hosts) |

## 5. State (`src/state/store.ts`)

One vanilla Zustand store. React reads it with `useApp(selector)`, and the engine uses `store.subscribe`. Actions live in `actions.*`, and components never call `setState` directly. The state is plain data only (no Three.js objects).

| Group | Fields |
|---|---|
| loading | `ready`, `loading` (stage → 0…1), `error` |
| selection | `selectedId`, `hoveredId` |
| visibility | `categories` (id → `on`/`ghost`/`off`), `hidden`, `ghosted` (id → true), `isolateId`, `isolateContext`, `ghostOpacity` |
| arch view | `explode` (0…1), `explodePhase` (1 in position / 2 laid out), `labels`, `clip` {enabled, axis, offset, flip}, `view` (preset or null), `autoRotate`, `orbitMode` (`fixed`/`free`) |
| tooth dissection | `dissectFdi`, `dissectLevel` (0 whole → 4 canals), `toothExplode` |
| UI | `numbering`, `theme`, `searchOpen`, `aboutOpen`, `panel` (layers/tree), `mobileSheet`, `mode` 🧩 |

`numbering`, `theme` and `orbitMode` are saved per viewer in `localStorage`.

**Visibility** (`state/visibility.ts`). `resolveMesh(meshKey, ctx)` is the only function that decides whether a mesh is `on`, `ghost`, `faint` (a quieter ghost used for context around a dissected tooth) or `off`. It combines categories, hide/ghost on the structure and its ancestors, tooth shell vs internal layers (`layersActive`), dissection-level rules (`dissectRule`), isolation, and any filters added with `registerVisibilityFilter` (the hook for modes and a future timeline). `revealPatch` makes a structure reachable, and `Engine.selectFromUI` uses it for search, tree, label and deep-link navigation.

## 6. Engine (`src/engine`)

The engine is a plain class with no React in it. It subscribes to the store in `onState()` and reacts to changes:

```
store change ─► Engine.onState ─┬─ refreshVisibility → resolveMesh per mesh → entry.visual
                                ├─ refreshHighlight (selection/hover) · refreshClip · refreshLabels
                                ├─ theme → applyTheme (exposure, bone shading)   orbitMode → rig.setMode
                                ├─ dissectFdi → updatePivot (fixed-orbit centre)
                                └─ explode / explodePhase → reframe / layoutBoard
loop (rAF) ─► controls.update + rig.tick (pivot spring) + animator.tick + tickVisuals
             (opacity fades, highlight, explode/board positions) → render only if something moved
```

- **Scene entries.** Each loaded mesh key becomes a `MeshEntry` with its material, its arch- and tooth-level explode offsets (computed once in `explode.ts`), its phase-2 board slot, and animated opacity and highlight. Picking raycasts visible meshes (opaque first) and maps them to the owning structure.
- **UI → engine.** Components get the engine from `useServices()` and call `selectFromUI(id, {focus})`, `focus(id)`, `ensureTooth(fdi)`, `setView(preset)`, `resetCamera()`, `zoom`, `orbit` and `setInsets`. Everything else goes through store actions.
- **Engine → UI.** The engine only writes to the store (`actions.select`, `setLoading`, `setState({view})`). It never calls React.
- **Camera** (`camera.ts`). OrbitControls with damping, `focusSphere` tweens along a spherical arc, 8 presets, and dynamic near/far. **Orbit modes:** *free* lets pan, zoom-to-cursor and focus move the target. *Fixed* keeps the target on a pivot: the dentition, or the tooth being dissected. After a pan it glides back (`pivotSpring`), and focus puts the structure on the pivot→camera line (`fixedFocusPose`).
- **Materials** (`materials.ts`). One `MeshPhysicalMaterial` per mesh, with a shared shader patch for:
  - the selection and hover highlight (colour blend plus a fresnel rim);
  - back faces drawn as flat "cut surface" colour, so sections look solid without a stencil;
  - edge darkening on muscles, nerves and vessels, plus a faint grain on muscles only;
  - light-theme exposure and bone shading (`THEME_LIGHTING`, `themedColor`).
- **Explode** (`explode.ts`, `layout.ts`).
  - *Arch, phase 1:* the upper complex moves up and the lower down. Teeth rise out of their sockets, nerves and vessels fan out by side, and muscles move outward. The orbicularis oris moves forward and down, clear of the incisors.
  - *Arch, phase 2 "Laid out":* every fully visible structure is shelf-packed on a board facing the viewer, in bands that read top to bottom like the head. Ghosted context fades out.
  - *Tooth level:* the layers separate along the tooth's axes.
- **Sections** (`section.ts`). One global clipping plane: sagittal, coronal or axial in world space, or view-aligned. While dissecting a tooth, the tooth's own frame is used (mesiodistal, buccolingual, horizontal).
- **Labels** (`labels.ts`). A DOM layer positioned each rendered frame, with priority decluttering and occlusion tests. Clicking a label selects the structure.

## 7. Assets and loading

The pipeline (details in [assets.md](assets.md)): BodyParts3D STL → `tools/pipeline/build_assets.py` → `compress.mjs` → `public/models/`. `build_assets.py` selects the dental FMA IDs, converts to Y-up centimetres, derives the third molars, and splits out the alveolar bone, condyles and fossae. It models the internal tooth layers (`tooth_layers.py`, a voxel SDF), sweeps the nerves and vessels along the Z-Anatomy centrelines in `tools/pipeline/data/z-anatomy-neurovascular.json` (made by `extract_z_anatomy.py`, which needs Blender's `bpy`), adds the schematic ones and the discs, and measures the arch-dissection tiers. `compress.mjs` applies gltf-transform with meshopt. `manifest.json` records each mesh's stage, file, bounds, provenance and FMA ID, plus tooth frames, roots, landmarks, paths and the dissection tiers (`explode`).

**Arch dissection ("in position").** The skull and maxillae move up and the mandible down by `explode.jaw`; each jaw then separates toward the bite in tiers, gingiva by `explode.*.gingiva` and teeth by `explode.*.teeth`, all straight up or down. The pipeline measures these distances as height fields over x/z so no tier passes through another. Nerve and vessel meshes carry a per-vertex jaw weight (0 = mandible, 1 = skull), stored in the vertex colour and turned into a morph target by the engine, so a vessel that runs between the jaws stretches instead of breaking. While a nerve or vessel layer is on, bone is drawn see-through (`'see-through'` in `state/visibility.ts`); the maxilla also turns see-through while a maxillary sinus is selected. How far each nerve or vessel recedes is decided in `engine/recede.ts`: dental nerves never recede, dental vessels recede while the jaws are dissected, and trunks marked `regional` in `anatomy/structures.ts` (outside the dental region) stay quiet and are never labelled on their own; faded paths never block picking or labels. The maxillary sinus is always translucent (`SINUS_OPACITY`).

| Stage | File | Contents | When (`Engine.loadAll` / `ensureTooth`) |
|---|---|---|---|
| 1 | `core.glb` | Jaws, gingiva, 32 tooth shells | Immediately (`ready` after this) |
| 2 | `context.glb` | Skull context, muscles, TMJ | Next |
| 3 | `neurovascular.glb` | Nerves and vessels (atlas and schematic) | Next |
| 4 | `teeth/tooth-XX.glb` | One tooth's internal layers | On demand (`ensureTooth`): dissection, search hit, deep link. Turning a section on in the overview loads all 32 (`ensureAllTeeth`, progress under `loading.teeth`). Tooth 36 is prefetched when idle. |

## 8. Anatomy, content and search

- **Registry** (`anatomy/registry.ts`). Builds every `Structure` (group / mesh / region / landmark) from the manifest, `structures.ts` and the tooth tables in `notation.ts`. That includes 32 teeth with crown and root regions, pulp, canals, apical foramina and pulp horns. Its main lookups are `get`/`require`, `ancestors`, `descendants`, `meshesOf`, `categoriesOfMesh`, `teeth()` and the `meshOwner` map (mesh key → structure). Add anatomy here, not in components.
- **Content** (`content/content.ts`). Looks up text by the most specific key (tooth type and arch, then the id, then the id with its qualifiers stripped) in `en/*.json`. Status: every entry with text is currently `draft`, and entries without text are `placeholder`. Per-entry `reviewed` status and `sources` are 🗺 planned; see [content.md](content.md).
- **Search** (`search/search.ts`). An in-house scorer over names, aliases, categories and every notation form. Numbers are read in the active numbering system first. `SearchPanel` calls `engine.selectFromUI(id, { focus: true })`. That reveals the hit (`revealPatch`: unhide it, turn on its categories, relax isolation), loads the tooth if needed, selects it and flies to it. The panel then pushes the URL.
- **About-dialog facts** are sourced in [sources.md](sources.md).

## 9. Build output and SEO

`vite.config.ts` contains a small plugin, with the metadata itself in `src/app/seo.ts` (unit-tested). It does the following:
- injects the title, description, Open Graph and Twitter tags into `index.html` (plus canonical, `og:image` and WebSite JSON-LD when `DS_SITE_URL` is set);
- writes `tooth/NN/index.html` for all 32 teeth with their own head tags (skipped with a relative base);
- writes `404.html` as a `noindex` copy of the app shell, `robots.txt`, and `sitemap.xml` (with `DS_SITE_URL`).

## 10. Modes and planned work

- ✅ **Explore**: everything above.
- 🧩 **Learn / Quiz / Compare**: `modes/modes.ts` defines the `Mode` interface, the lesson format, `pickQuizTarget` and `switchMode` (which registers a visibility filter). There's no UI or content for them yet: `actions.setMode` exists, but nothing calls it.
- 🗺 Primary dentition and an eruption timeline (`ToothMeta.dentition`, a visibility filter), measured nerve and vessel paths, procedure modules, and expert-reviewed text. See the README roadmap.

## 11. Where to start

| I want to… | Start in | Also read |
|---|---|---|
| Change a panel, button or copy | `src/ui/*` and `src/styles/app.css` (tokens in `tokens.css`) | [CONTRIBUTING](../CONTRIBUTING.md) (accessibility), [sources.md](sources.md) if About text changes |
| Add or rename a structure | `anatomy/structures.ts` or `registry.ts`, then `content/en/*.json` | [content.md](content.md) |
| Edit educational text | `src/content/en/*.json` | [content.md](content.md) |
| Change how things look in 3D | `engine/materials.ts` (colours, shader), `Engine.ts` (`applyTheme`, lights) | |
| Change explode or the laid-out board | `engine/explode.ts`, `engine/layout.ts` (both pure and tested) | |
| Change camera behaviour | `engine/camera.ts`, `Engine.ts` (`setView`, `focus`, `updatePivot`) | |
| Change visibility rules | `state/visibility.ts` | |
| Add a URL or change metadata | `app/router.ts`, `app/seo.ts`, `vite.config.ts` | |
| Replace or add 3D data | `tools/pipeline/*` | [assets.md](assets.md), [CREDITS.md](../CREDITS.md) (licences) |
| Build a Learn/Quiz mode | `modes/modes.ts`, `registerVisibilityFilter` | §10 |

## 12. Performance and accessibility

- **Performance.** Rendering happens on demand, so an idle scene uses almost no GPU. Pixel ratio is capped at 2 (1.5 on coarse pointers). There is about one draw call per visible mesh. Tooth interiors load lazily. Materials share one program (`customProgramCacheKey`).
- **Accessibility.**
  - Every control is a labelled `<button>`/`<input>`.
  - The structure tree is a keyboard-navigable `role="tree"`, so the canvas isn't the only path to the content.
  - The camera controls in the bottom toolbar show their names on hover, focus and touch; the View picker returns focus to its button and closes on Escape.
  - Layer visibility toggles are the colour swatches: buttons with `aria-pressed`, a check mark when on, so state never relies on colour alone.
  - Keyboard shortcuts are handled in `useKeyboard.ts` and listed in the About dialog and the README.
  - `prefers-reduced-motion` (or `?motion=reduce`) makes camera and explode changes instant.
  - Text contrast is at least 4.5:1, with visible focus rings.


## 13. Dental feedback features

`anatomy/feedbackStructures.ts` extends the existing registry; `passages.ts` links passage routes and resolves landmark hosts. The visibility resolver filters unrelated nerves during a passage view. The existing transparency controls are reused by the Nerves & muscles preset.

`content/canal-counts.json` contains sourced counts for 16 tooth types, consumed by `canalFrequency.ts`, the detail table and static guides. `feedbackAnatomy.ts` supplements the existing multilingual content without changing its draft review status. `feedbackNames.ts` and `feedback.ts` supply translated names and controls.

`engine/jawMotion.ts` provides pure joint transforms and compliant-tissue targets. The engine applies rigid mesh matrices to the lower arch/discs and uses morph target 1 for jaw deformation, retaining dissection target 0. Playback remains outside React; DOM progress is updated at 10 Hz. `jawControls`, `jawSide`, `jawOpening` and `jawPlaying` coexist with the existing store; dissection and arch-layout actions close the joint controls. See [feedback-anatomy.md](feedback-anatomy.md) for the fitted asset plan and review workflow.
