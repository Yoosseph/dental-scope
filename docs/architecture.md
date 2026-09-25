# Dental Scope — Architecture

> Phase 3. How the application is organised and why.

## 1. Principles

1. **The 3D explorer is the product.** One full-bleed canvas; UI islands float around it.
2. **Data drives everything.** Anatomy lives in a structure registry built from data tables. UI components never hardcode structure IDs.
3. **React never renders per frame.** A small imperative engine owns Three.js; React renders chrome and subscribes to coarse state.
4. **Render on demand.** The engine renders only when something changed (camera motion, tween, state change).
5. **Stage everything.** First paint needs only jaws + teeth; context, neurovasculature and internal tooth anatomy stream in afterwards.
6. **Be honest about data.** Every structure carries provenance (`source`, `derived`, `modeled`, `schematic`) and every text entry a verification status.

## 2. Stack

| Concern | Choice | Reason |
|---|---|---|
| Build | Vite + TypeScript (strict) | Fast, static output, no server required |
| UI | React 19 | Component model for panels |
| 3D | Three.js (imperative engine) | Full control of the render loop, materials, picking, clipping; avoids per-frame React work. R3F was considered; the engine's needs (on-demand render, material state machine, DOM labels, stencil-free caps) are simpler without a reconciler in the middle |
| State | Zustand (vanilla store) | Subscribable from both React (`useStore(selector)`) and the engine (`store.subscribe`) without duplication |
| Geometry compression | glTF + `EXT_meshopt_compression` + quantization | Decoder is tiny and ships with Three; better than Draco for many small meshes |
| Search | In-house scorer | ~500 entries; a dependency (Fuse etc.) isn't warranted |
| Routing | In-house History API router | Two route shapes |

Runtime dependencies: `react`, `react-dom`, `three`, `zustand`. Nothing else.

## 3. Folder layout

```
src/
  app/            App shell, providers, routing glue
  anatomy/        Structure registry, schema types, tooth tables, notation, hierarchy builders
  content/        Educational text (per-structure JSON), content loader, verification status
  search/         Index builder + query scorer
  state/          Zustand store, actions, selectors
  engine/         Engine (renderer/loop), CameraRig, Picking, Materials, Visibility,
                  Explode, Clipping, Labels, AssetLoader, SceneRegistry
  ui/             React components (panels, rail, dock, search, detail, tree, icons)
  modes/          Mode interface + Explore (implemented), Learn/Quiz/Compare (scaffolded)
  styles/         Tokens + global CSS
tools/pipeline/   Python + Node asset pipeline (raw BodyParts3D → production GLB)
public/models/    Production assets (CC BY-SA 2.1 JP)
docs/
```

## 4. Anatomical schema

```ts
type Provenance = 'source' | 'derived' | 'modeled' | 'schematic';
type StructureKind = 'group' | 'mesh' | 'region' | 'landmark';

interface Structure {
  id: string;                 // stable, URL-safe: "tooth-36", "enamel-36", "inferior-alveolar-nerve-left"
  name: string;               // "Mandibular left first molar"
  kind: StructureKind;        // group = container, mesh = owns geometry, region = subset of other meshes, landmark = point
  parent: string | null;
  children: string[];
  categories: CategoryId[];   // for layer toggles: 'permanent-teeth', 'enamel', 'nerves', ...
  meshes: string[];           // scene node keys this structure owns (resolved recursively for groups)
  aliases: string[];          // search synonyms
  provenance: Provenance;
  sourceRef?: string;         // e.g. "FMA55704"
  stage: 1 | 2 | 3 | 4;       // loading stage that provides its geometry
  asset?: string;             // lazily loaded file (stage 3 teeth)
  tooth?: ToothMeta;          // only for teeth
  anchor?: [number, number, number]; // label/landmark point (filled from bounds at load)
  labelPriority?: number;     // higher = survives label decluttering longer
}

interface ToothMeta {
  fdi: string; universal: string; palmer: string;
  arch: 'maxillary' | 'mandibular';
  side: 'right' | 'left';
  type: 'central-incisor' | 'lateral-incisor' | 'canine' | 'first-premolar' | 'second-premolar'
      | 'first-molar' | 'second-molar' | 'third-molar';
  dentition: 'permanent' | 'primary';
  roots: RootSpec[];          // typical configuration (content, verifiable)
  eruption?: { fromYears: number; toYears: number }; // future timeline mode
}
```

Educational content is separate (`src/content/en/*.json`) so it can be replaced by verified sources without code changes:

```ts
interface StructureContent {
  id: string;
  summary?: string; location?: string; function?: string; clinical?: string;
  facts?: { label: string; value: string }[];
  related?: string[];
  status: 'placeholder' | 'draft' | 'reviewed';
  sources?: { title: string; url?: string }[];
}
```

The detail panel renders fields that exist, shows the status badge, and always shows provenance.

### Hierarchy (generated, not hand-written)

```
dental-anatomy
├── maxilla ─ maxillary-alveolar-process
│   └── maxillary-dentition ─ upper-right-quadrant ─ tooth-18 … tooth-11
│                            └ upper-left-quadrant  ─ tooth-21 … tooth-28
├── mandible ─ mandibular-alveolar-process, condyles
│   └── mandibular-dentition ─ lower-left / lower-right quadrants
├── periodontium ─ gingiva-upper, gingiva-lower, periodontal-ligament, cementum, alveolar bone
├── neurovascular ─ nerves ─ inferior alveolar, mental, incisive, lingual, superior alveolar …
│                └ vessels ─ inferior alveolar artery/vein …
├── tmj ─ left/right: condyle (region), articular fossa (region), articular disc
├── skull-context ─ zygomatic, temporal, palatine, sphenoid, …
└── muscles-of-mastication ─ masseter, temporalis, pterygoids, buccinator, orbicularis oris
tooth-XX
├── crown (region) ─ enamel-XX, coronal-dentin-XX, pulp-chamber-XX (+ pulp horns: landmarks)
├── root  (region) ─ radicular-dentin-XX, cementum-XX, root-canal-XX-<root>[-<n>], apical-foramen-XX-* (landmarks)
├── pulp (group)   ─ pulp-chamber-XX, root-canal-XX-*
└── pdl-XX
```

Tooth tables (`anatomy/teeth.ts`) generate all 32 teeth and their sub-structures; notation (`anatomy/notation.ts`) converts FDI ↔ Universal ↔ Palmer.

## 5. State

One Zustand store; slices are plain data (Sets as arrays/records) and actions are pure functions over it.

| Slice | Fields |
|---|---|
| selection | `selectedId`, `hoveredId` |
| visibility | `hidden: Record<id,true>`, `ghosted: Record<id,true>`, `categoryOff: Record<cat,true>`, `isolateId`, `globalOpacity` |
| view | `explode` (0–1), `labels`, `clip: {enabled, axis, offset, flip}`, `numbering` |
| tooth | `dissectToothId`, `dissectLevel` (0 whole → 4 canals), `toothExplode` |
| mode | `mode: 'explore' | 'learn' | 'quiz' | 'compare'` |
| loading | per-stage progress |
| ui | panel open states (mobile sheets), search open |

**Visibility resolution** is one pure function: a mesh is visible iff its structure (and ancestors) are not hidden, at least one of its categories is on, it is inside the isolate subtree (if any), and every registered *visibility filter* (mode, dissection level, future timeline) passes. Opacity = ghosted ? ghost : 1. This is how timeline/procedure modes plug in without touching UI code.

## 6. Engine

```
Engine
 ├─ Renderer / Scene / PerspectiveCamera, ACES tone mapping, sRGB, env light, pixel ratio ≤ 2
 ├─ loop: requestAnimationFrame only while `needsRender || tweens active || controls damping`
 ├─ SceneRegistry   meshKey → Object3D, structureId → meshes, bounds cache
 ├─ AssetLoader     staged GLTF loading (meshopt), progress → store, lazy tooth assets
 ├─ Materials       tissue palette; per-mesh material state: base / hover / selected / ghost; back-face cap shader for sections
 ├─ Visibility      store → mesh.visible / opacity (animated fades)
 ├─ Picking         raycast visible meshes on pointer; hover throttled to rAF; click vs drag discrimination
 ├─ CameraRig       OrbitControls + tweened focus (bounds → distance via FOV), presets, reduced motion
 ├─ Explode         arch-level and tooth-level offset fields, animated
 ├─ Clipping        one global plane (sagittal/coronal/axial/custom-to-view) applied to materials; cut faces rendered as flat tissue colour
 └─ Labels          DOM layer; projected per frame; priority + overlap declutter; click → select
```

The engine subscribes to store slices and never calls React. React components call store actions and, for camera commands, `engine.camera.*` via a context handle.

### Selection highlight
Selected meshes blend toward a cool highlight colour with a faint emissive lift; hover uses a lighter version. Everything else is untouched (no global dimming) unless "focus mode" is on, in which case non-selected meshes are ghosted.

### Cross-sections
Materials use `clippingPlanes`; `side: DoubleSide`; a small `onBeforeCompile` patch renders back faces as an unlit, slightly darkened tissue colour. Because every tissue is a closed solid, the back faces seen through a cut read as solid cut surfaces — enamel thickness, dentin, pulp and canals appear as clean coloured bands without stencil passes.

### Explode
- **Arch level:** maxillary complex moves up, mandibular complex down, teeth move outward along their arch normal, gingiva lifts off, nerves/vessels move medially/laterally by side.
- **Tooth level:** layers separate along the tooth's long axis in anatomical order (enamel shell → dentin → pulp → canals), cementum/PDL radially.

Offsets are computed once from bounds; animation interpolates a scalar.

## 7. Assets & pipeline

```
BodyParts3D STL (mm, Z-up)
 → tools/pipeline/build_assets.py
     • select dental FMA IDs, rename to registry IDs
     • transform to Y-up, centre on the dental arch, scale to cm
     • derive third molars from second molars
     • per tooth: voxel SDF → cervical line → enamel / dentin (coronal, radicular) / cementum / PDL / pulp chamber / canals
     • partition alveolar bone from maxilla & mandible
     • schematic nerves, vessels, TMJ discs from computed landmarks
     • write glTF per stage with node names = mesh keys, bounds in manifest.json
 → tools/pipeline/compress.mjs (gltf-transform: dedup, weld, simplify, quantize, meshopt)
 → public/models/{core,context,neurovascular}.glb, public/models/teeth/tooth-XX.glb, manifest.json
```

Loading stages:

| Stage | File | Contents | When |
|---|---|---|---|
| 1 | `core.glb` | Maxilla, mandible, gingiva, 32 teeth (outer shells) | Immediately |
| 2 | `context.glb` | Skull context, muscles of mastication, TMJ | After first frame |
| 3 | `neurovascular.glb` | Schematic nerves & vessels | After stage 2 |
| 4 | `teeth/tooth-XX.glb` | Internal anatomy of one tooth | On demand (dissect / search hit / deep link); idle prefetch of the detailed exemplar |

## 8. Search

`search/index.ts` builds entries from the registry: name, aliases, category names, and all notation forms (`tooth 36`, `#19`, `19`, `36`, `LL6`, `UR1`…). Queries are normalised (lower-case, punctuation stripped, number words). Scoring: exact > prefix > word-prefix > subsequence, with boosts for teeth when the query is numeric and interpreted in the **active numbering system** first (so "11" means FDI 11 in FDI mode and Universal 11 in Universal mode — both shown, active one first). Selecting a result: reveal ancestors (unhide + category on + clear isolate if excluded), load tooth asset if needed, select, fly camera to bounds, open detail panel, push URL.

## 9. Routing / deep links

| URL | Effect |
|---|---|
| `/` | Overview |
| `/tooth/36` | Select & focus tooth 36 (FDI) |
| `/tooth/36/dissect` | Enter dissection of tooth 36 |
| `/structure/<id>` | Select & focus any structure |

Selection changes `replaceState`; explicit navigations (search, tree) `pushState`. `popstate` restores. The static host needs an SPA fallback (`404.html` copy is generated at build for GitHub Pages).

## 10. Modes

```ts
interface Mode {
  id: 'explore' | 'learn' | 'quiz' | 'compare';
  enter(ctx: ModeContext): void;
  exit(ctx: ModeContext): void;
  visibilityFilter?(s: Structure): boolean;
  Panel?: React.ComponentType;   // mode-specific UI in the dock
}
```

- **Explore** — implemented.
- **Quiz** — scaffold: pick a random structure from a pool, highlight without label, user answers via search box.
- **Compare** — scaffold: two tooth IDs; engine places clones of both tooth assets side by side in a secondary group.
- **Learn** — lessons are data (`lessons/*.json`: steps with target ids, camera preset, visibility, text).

**Timeline (future):** `ToothMeta.eruption` + a `dentitionAge` value in the store and a visibility filter; primary teeth are just more registry entries with `dentition: 'primary'`.

**Procedures (future):** a procedure is data: ordered steps, each a *scene diff* (visibility, opacity, extra assets such as a restoration or implant, transforms) plus text. Assets load through the same staged loader.

## 11. Performance budget

- First load (stage 1): ≤ 2.5 MB transferred, interactive < 2 s on broadband.
- ≤ ~150 draw calls in overview (one per structure mesh; teeth share materials by tissue).
- Tooth internal assets ≤ 300 KB each.
- Render-on-demand: idle GPU usage ≈ 0.
- Pixel ratio capped at 2 (1.5 on mobile).

## 12. Accessibility

- Every control is a `<button>`/`<input>` with a label; keyboard: `/` search, `Esc` clear/close, `F` focus selection, `H` hide, `I` isolate, `R` reset, arrow keys orbit, `+/-` zoom, `[`/`]` dissect level.
- Tree view is a proper `role="tree"` for keyboard-only navigation of all structures (the canvas is not the only path to content).
- `prefers-reduced-motion`: camera jumps with short fades, no auto-rotate, explode animates instantly.
- Contrast ≥ 4.5:1 for text; visible focus rings.
