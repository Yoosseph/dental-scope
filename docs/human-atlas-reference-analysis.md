# Human Atlas — Reference Analysis

> Phase 1 of Dental Scope. This document records how [human-atlas.co](https://human-atlas.co/) is built and how it behaves, so that Dental Scope can match its interaction quality while remaining an original product.
> Inspected live in Chrome on 2026-09-25 (desktop, 1920×911 canvas). Nothing from Human Atlas — code, text, assets, branding — is reused in Dental Scope.

---

## 1. Page structure

Human Atlas is a single full-bleed WebGL canvas with a small number of floating "island" panels. There is no marketing page: the explorer *is* the landing page.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ • eyebrow           (lang pills)  [ Find a structure  / ] [Ask] [ⓘ]      │
│ Title  [3D]                                                              │
│ 2,234 modeled pieces · source                                            │
│                                                                          │
│ ┌ Systems  15 ┐                                         ┌ Detail card ┐ ┌─┐│
│ │ All|Skel|Org│               3D FIGURE                 │ System      │ │¾││
│ │ • Skeleton ◉│                                         │ Title       │ │F││
│ │ • Muscles  ◉│                                         │ description │ │S││
│ │ …          │                                          │ ref · count │ │B││
│ │ n visible  Hide all                                   │ [Isolate ›] │ │↻││
│ └────────────┘                                          │ Hide · Clear│ │⟲││
│                     ┌ Explode anatomy   0% ┐ ⟲ Reset    └─────────────┘ └─┘│
│                     └ Assembled ─●── Every piece ┘                       │
│ Drag to orbit · Pinch to zoom · Tap to inspect           Source & credits ↗│
└──────────────────────────────────────────────────────────────────────────┘
```

| Region | Content | Notes |
|---|---|---|
| Top-left identity | Small eyebrow with status dot, large title with an edition chip, one meta line (piece count · data source) | Establishes credibility (count + source) instantly |
| Top-right actions | Language pills, search trigger with `/` keyboard hint, an assistant button, an info button | Search is a *trigger button* that opens a floating panel, not a permanent input |
| Left panel | "Systems" layers card: count badge, segmented presets (All / Skeleton / Organs), scrolling list of system rows (color dot · name · piece count · toggle switch), footer "N pieces visible · Hide all" | Clicking the *name* = "Show only X"; the *switch* = toggle X |
| Right rail | Vertical view preset rail: ¾, F, S, B, auto-rotate, reset view & layers | Active preset shown as filled dark square |
| Right detail card | Appears on selection (see §5) | Replaces nothing — floats left of the rail |
| Bottom center dock | "Explode anatomy" slider 0–100 % with numeric readout, labels "Assembled / Every piece", Reset button | Always visible; the only persistent bottom control |
| Bottom corners | Gesture hints (left), Source & credits (right) | Very small, muted |
| Stage caption | Tiny caption on the pedestal ("Adult human · male"); changes to the isolated structure's name when isolating | Subtle context cue |

## 2. Visual language

- **Light, clinical, calm.** Background `#f3f4f4`, cards pure white with a very soft shadow and ~12 px radius, primary accent a desaturated navy `#263b48`, muted text `#68727d`, destructive `#a8574a`. Borders are nearly invisible (`#18253618`).
- **Typography:** Inter throughout; monospace for the keyboard hint. Title ~30 px semibold with tight tracking; everything else 11–14 px. Small caps/letter-spaced eyebrows for categories.
- **Density:** high information density with lots of empty space around the model; panels are narrow (≈200 px systems, ≈250 px detail).
- **Colour coding:** each system has a desaturated dot colour that matches its material colour on the model.
- **Scene:** soft studio lighting, ACES filmic tone mapping, gentle fog, a faint circular pedestal/ground ring under the figure, radial vignette on the backdrop. Materials are matte (MeshStandardMaterial, a little physical material).
- **Selection highlight:** selected meshes are re-tinted a pale mint/cyan (not an outline). Very legible against the warm red muscles.
- **Theme:** light only (no dark mode). `color-scheme: light`, theme-color `#f3f4f4`.

## 3. Interaction model

| Action | Behaviour |
|---|---|
| Hover over model | Cursor feedback only — no tooltip in the default state |
| Click a mesh | Selects it: mint tint, detail card opens. **Camera does not move.** |
| Isolate structure | Hides everything else and frames the camera on the structure with a smooth tween; the primary button flips to "Show surrounding anatomy" |
| Hide structure | Hides it, keeps the rest |
| Clear selection | Removes tint, closes card |
| Drag | Orbit around a fixed vertical target (damped OrbitControls) |
| Wheel / pinch | Zoom with a narrow distance range (you can't get very close to small structures in the full-body view) |
| View rail | ¾ / Front / Side / Back presets with smooth tween, auto-rotate toggle, full reset |
| System row name | "Show only <system>" |
| System row switch | Toggle one system |
| Presets | All / Skeleton / Organs change which systems are on |
| Explode slider | Continuously interpolates every piece from its assembled position toward a separated layout (systems separate into bands; at high values pieces spread into a sparse field). Reversible and scrubbable. |
| `/` | Opens search |

## 4. Search

- A floating panel ("Find a structure") with a text field and a scrolling result list.
- Results are **concepts**, not only meshes: e.g. "molar" → *Molar Tooth (8)*, *Premolar Tooth (8)*, *Upper … Molar Tooth (4)* — each with a piece count. This is powered by an FMA "concept" index where each concept lists its member meshes.
- Choosing a result selects all member pieces and opens the detail card. **It does not move the camera**, so selecting "Molar Tooth" from the full-body view shows nothing visibly changed. → Dental Scope should fly to the result (the brief requires it).

## 5. Information panel

Fields: coloured system bar · system eyebrow · title · description · provenance note · "Atlas reference" (FMA id) · "Selected pieces" count · "View anatomical source ↗" · primary Isolate button · Hide · Clear selection.

The description is **system-level boilerplate** ("Bones form the supporting framework…") rather than structure-specific. The honest provenance line ("System overview · structure identified from source anatomy") is a good pattern: it tells users what is generic vs specific. Dental Scope should keep that honesty but provide structured, per-structure fields with explicit content status (see architecture).

## 6. Loading experience

- The shell UI renders immediately; the canvas shows the figure **filling in progressively** as geometry chunks stream in, with a small centered card: "Preparing the anatomy · N of 2,234".
- Data: `models/atlas.json` (~200 KB manifest: parts, concepts, chunk list, bounds) then 15 × ~2.2 MB gzip binary chunks (`body-N.bin.gz`) fetched in parallel and decompressed with `DecompressionStream`. ≈33 MB total transfer.
- Manifest per part: id, name, concept id, system, chunk index, byte offsets for positions/normals/indices, vertex/index counts, **precomputed bounds**. Bounds let the app frame cameras and build explode layouts before/without touching geometry.
- Geometry was pre-simplified with meshoptimizer (max relative error 0.002; 6.7 M → 2.3 M triangles).

## 7. Technical observations

| Area | Finding |
|---|---|
| Build | Vite (hashed `assets/main-*.js`, single 1 MB bundle + 34 KB CSS) |
| UI | React (createRoot) with `useSyncExternalStore` — i.e. an external store, not React state, drives UI |
| 3D | Three.js r159, **imperative** (no React Three Fiber). OrbitControls with damping; lerp/slerp-based camera tweens |
| Draw calls | `BatchedMesh` / `InstancedMesh` to keep 2,234 parts to a handful of draw calls |
| Rendering | ACES filmic tone mapping, sRGB output, PMREM environment, shadow maps, fog, capped pixel ratio, `invalidate`-style render requests |
| Clipping | Clipping-plane support exists in the bundle but isn't exposed in the UI |
| Styling | shadcn-style CSS variables; breakpoints at 1400 / 1000 / 767 px and a landscape-short query; `prefers-reduced-motion` rule |
| Routing | **No deep links.** URL never changes on selection/isolation. Language is path-based (`/es/`, `/ko/`, `/ar/`) |
| A11y | Semantic buttons with good labels ("Show only Skeleton", switch "Show Skeleton", "Reset view and layers"), range input for explode. Canvas content itself isn't keyboard reachable |
| Mobile | Layers panel becomes an off-canvas sheet (`.layers-panel.mobile-open`), the detail card becomes a `.detail-sheet`, a `.bottom-dock` holds condensed controls |

## 8. What makes it feel effortless

1. **Zero friction:** no splash, no sign-in, no homepage — model on screen in < 1 s, streaming in.
2. **Few, quiet controls** placed at the edges; the figure owns the centre.
3. **Every control answers visually and instantly** (tint, tween, slider scrub).
4. **Numbers everywhere** (pieces, visible count) signal a serious dataset.
5. **Consistent colour language** between the list and the model.
6. **Two-level visibility:** "only this" vs "toggle this".
7. **Isolation as the bridge** from whole-body to single-structure exploration.

## 9. Gaps Dental Scope should improve on

- Search/selection should **fly the camera** to the target and reveal hidden parents.
- **Deep links** for every structure (`/tooth/11`, `/structure/pulp-36`).
- **Hover labels** (name tooltip on hover) — cheap and helpful at dental scale where pieces are small.
- **Structure-specific content** with explicit verification status instead of boilerplate.
- **Cross-section tool** exposed in the UI (essential for teeth).
- **Ghost/opacity**, not just show/hide, so inner anatomy can be seen in context.
- **Hierarchy browser** (a tree), because dentistry is deeply nested (arch → quadrant → tooth → tissue).
- Deeper zoom for small structures (auto-framing by bounding box).
- Dark mode (useful for clinical/lecture settings) — optional.

## 10. What to adapt for dentistry

| Human Atlas pattern | Dental Scope adaptation |
|---|---|
| Systems panel with counts & switches | **Layers** panel with dental categories (Teeth, Gingiva, Bone, Nerves, Vessels, TMJ, Glands…) and tissue layers (Enamel, Dentin, Cementum, Pulp) |
| All / Skeleton / Organs presets | Presets: **All / Teeth / Hard tissue / Soft tissue** |
| ¾ / F / S / B rail | ¾ / Front / Left / Right / Superior / Inferior / **Occlusal (upper & lower)** |
| Explode anatomy | Two-level explode: **arch level** (jaws apart vertically, teeth fan outward, gingiva/bone lifted) and **tooth level** (enamel shell, dentin, pulp, canals separate along the long axis) |
| Isolate | Isolate + **Dissect** mode for the detailed tooth (progressive layer peeling) |
| FMA concept search | Dental search with tooth numbering (Universal, FDI, Palmer-ish text), synonyms, abbreviations |
| Pedestal caption | Context caption (e.g. "Permanent dentition · adult", "Tooth 36 · dissect") |

## 11. What must NOT be copied

- Name, logo, wordmark, favicon, eyebrow copy, taglines, descriptions, "Ask anatomy" feature naming.
- Any code, CSS, or bundle contents. The exact colour tokens are not reused; Dental Scope defines its own palette.
- Human Atlas's processed geometry (`atlas.json`, `body-*.bin.gz`). Where Dental Scope uses BodyParts3D it must obtain it **from the original distributor** under CC BY-SA and process it with its own pipeline.
- Layout pixel-for-pixel. We adopt the *pattern* (floating islands around a dominant canvas), not the composition.
