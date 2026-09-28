# Credits

## Anatomical data

**BodyParts3D** — © The Database Center for Life Science (DBCLS), licensed under
[Creative Commons Attribution-Share Alike 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en).

> BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan

- Original distribution: <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html>
- Verbatim STL mirror used by the pipeline: <https://github.com/Kevin-Mattheus-Moerman/BodyParts3D> (Kevin M. Moerman; code MIT, content CC BY-SA 2.1 JP)
- Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K. *BodyParts3D: 3D structure database for anatomical concepts.* Nucleic Acids Research 37 (2009) D782–D785.

All geometry in `public/models/` is derived from BodyParts3D and is therefore
distributed under the same licence (share-alike). The nerve and vessel paths in
`public/models/neurovascular.glb` are also derived from Z-Anatomy, so that file is
distributed under CC BY-SA 4.0 (CC BY-SA 2.1 allows adaptations to be shared
under a later version of the same licence). The per-asset list with
modifications is in [docs/assets.md](docs/assets.md). The social preview image
`public/og-image.png` is a render of these models and carries the same licence.

**Z-Anatomy** — the open-source 3D anatomy atlas by Lluís Vinent and contributors, licensed under
[Creative Commons Attribution-Share Alike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
Z-Anatomy is itself built on BodyParts3D.

- Source: <https://github.com/Z-Anatomy/Models-of-human-anatomy> (`Z-Anatomy.zip`, `Startup.blend`)
- Used for: the centrelines of the trigeminal, maxillary, mandibular, inferior alveolar, incisive, mental, lingual, buccal and infraorbital nerves; the external carotid, maxillary, inferior alveolar, posterior superior alveolar, descending palatine, buccal and facial arteries; and the internal jugular, retromandibular, maxillary and facial veins.
- Extracted and fitted by `tools/pipeline/extract_z_anatomy.py`; the fitted centrelines are in `tools/pipeline/data/z-anatomy-neurovascular.json` (same licence).

## Modifications made by Dental Scope

- Selected the dental and oral subset; renamed meshes to Dental Scope IDs.
- Transformed to a Y-up, centimetre coordinate frame centred on the dentition.
- Simplified meshes (quadric decimation) and compressed them (meshopt).
- Derived the four third molars from the adjacent second molars.
- Partitioned alveolar bone, mandibular condyles and articular fossae from the source bones.
- Modeled internal tooth anatomy (enamel, dentin, cementum, periodontal ligament, pulp chamber, root canals) inside each tooth shape.
- Sampled the Z-Anatomy nerve and vessel curves, fitted them onto the BodyParts3D jaws (similarity ICP), ended the dental nerve branches at the tooth apices, trimmed the neck vessels just below the angle of the mandible, reduced the trigeminal nerve to its ganglion, left out the external jugular vein and swept them into tubes.
- Modeled the maxillary sinuses inside the BodyParts3D maxillae (neither source includes them).
- Added schematic superior alveolar nerves, the inferior alveolar vein, the pterygoid venous plexus and TMJ discs, placed from computed landmarks and joined to the atlas paths.

## Software

- [three.js](https://threejs.org) — MIT
- [React](https://react.dev) — MIT
- [Zustand](https://github.com/pmndrs/zustand) — MIT
- [meshoptimizer](https://github.com/zeux/meshoptimizer) — MIT
- [glTF Transform](https://gltf-transform.dev) — MIT
- [trimesh](https://trimesh.org), [scikit-image](https://scikit-image.org), [SciPy](https://scipy.org), [NumPy](https://numpy.org), [fast-simplification](https://github.com/pyvista/fast-simplification) — MIT / BSD (pipeline only)

## Fonts

- [Inter Tight](https://fonts.google.com/specimen/Inter+Tight), [Source Serif 4](https://github.com/adobe-fonts/source-serif) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/) — SIL Open Font License 1.1, self-hosted via [Fontsource](https://fontsource.org/)

