# Phase 5 — Dental Scope vs Human Atlas

Side-by-side review of the vertical slice against the reference ([analysis](human-atlas-reference-analysis.md)). Human Atlas was inspected live in desktop Chrome; Dental Scope was exercised in desktop and phone viewports (1440×860, 1100×700, 390×844) through the same tasks: land, orient, find a structure, inspect it, isolate it, separate the anatomy, go inside.

## Scorecard

| Dimension | Human Atlas | Dental Scope (this slice) | Notes / changes made during the review |
|---|---|---|---|
| **Landing** | Explorer on first paint, figure streams in with a small progress card | Same pattern: jaws & teeth (≈0.5 MB) paint first; skull, nerves stream after; compact progress chip | Initial framing tightened on the dentition (it first opened too wide, then too close) |
| **Visual polish** | Calm light palette, soft shadows, matte materials, mint selection tint | Own palette (porcelain + deep teal), Inter Tight / JetBrains Mono, tissue-specific materials (clear-coated enamel, sheen on gingiva), light **and dark** themes | Fixed: bone partition cracks showing dark back faces; cut-surface colour space; over-strong highlight replaced by a fresnel rim |
| **Camera** | Damped orbit, presets ¾ F S B, tween on isolate | Damped orbit, **eight presets incl. occlusal views**, arcing spherical tweens, bounding-box fitting, zoom-to-cursor, dynamic near/far for tooth scale | Added optical-centre offset so focus targets stay clear of the detail panel and mobile sheets; explode widens the framing automatically |
| **Selection feedback** | Tint + detail card; camera does not move | Tint with fresnel rim, hover tint + name tooltip, detail card; **search/tree/deep links fly to the target** | Removed whole-tooth tint while dissecting (it hid the tissue colours) |
| **Discoverability** | Systems list, search trigger with `/`, gesture hints | Same, plus hierarchy tree, suggestion chips in search, “Explore inside this tooth” primary action, labelled dissection stepper, keyboard shortcut list in About | — |
| **Search** | Concept results with piece counts; no camera move | Names, synonyms, **tooth numbers in FDI/Universal/Palmer** (active system first), per-tooth context line; reveals hidden parents, loads assets, flies, updates URL | Fixed input focus on open |
| **Information** | System-level boilerplate + FMA reference | Per-structure summary, function, clinical relevance, facts (typical roots/canals/eruption), notation chips, breadcrumbs, contains / related links, **provenance + review status** | Text is draft and labelled as such |
| **Separation** | One explode slider for everything | Arch-level explode (jaws, teeth out of sockets, nerves/vessels fanned by type) **and** tooth-level layer separation | Alveolar bone now moves with its jaw (gaps exposed back faces) |
| **Inner anatomy** | Not applicable | Five-step dissection; sections in the tooth’s own planes; all 32 teeth sectioned at once in the overview | Hairline gaps between tissues remove z-fighting in cut faces |
| **Labels** | None by default | Optional anchored labels with decluttering, occlusion and UI-avoidance | Labels no longer sit under panels; occlusion tolerance tightened so inner layers hide correctly |
| **Deep links** | None | `/tooth/36`, `/tooth/36/dissect`, `/structure/<id>`, back/forward | — |
| **Responsive** | Off-canvas layers, detail sheet | Bottom sheets for layers, details and tools; mobile bar; view rail becomes a scroller | — |
| **Accessibility** | Good button labels | Labels, `role=tree` hierarchy, radiogroups, keyboard shortcuts, focus rings, reduced motion (also `?motion=reduce`), forced-colours borders | — |
| **Performance** | ≈33 MB geometry, BatchedMesh | ≈0.5 MB first paint, ≈1 MB for the whole mouth, ≈120 KB per tooth on demand; render-on-demand loop; ~150 draw calls in overview | BatchedMesh not needed at this scale |

## Where Human Atlas is still ahead

- **Scale & breadth:** thousands of structures across the whole body.
- **Measured anatomy everywhere:** Dental Scope's nerves, vessels and TMJ discs are schematic, and internal tooth anatomy is modeled, not scanned. This is shown in the UI, but real data would be better (see roadmap).
- **Localisation:** Human Atlas ships four languages.

## Next polish items

1. Replace schematic neurovasculature with measured paths (Z-Anatomy; CBCT-derived mandibular canal where licences allow).
2. Screen-space ambient occlusion for depth between teeth (behind a quality toggle).
3. Hover preview in the tree (highlight on hover without selecting).
4. Guided first-run hint pointing at a tooth (“click any tooth”).
5. Label leader lines that bend around the tooth in dissection view.
