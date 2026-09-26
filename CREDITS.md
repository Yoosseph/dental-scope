# Credits

## Anatomical data

**BodyParts3D** — © The Database Center for Life Science (DBCLS), licensed under
[Creative Commons Attribution-Share Alike 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en).

> BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan

- Original distribution: <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html>
- Verbatim STL mirror used by the pipeline: <https://github.com/Kevin-Mattheus-Moerman/BodyParts3D> (Kevin M. Moerman; code MIT, content CC BY-SA 2.1 JP)
- Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K. *BodyParts3D: 3D structure database for anatomical concepts.* Nucleic Acids Research 37 (2009) D782–D785.

All geometry in `public/models/` is derived from BodyParts3D and is therefore
distributed under the same licence (share-alike). The per-asset list with
modifications is in [docs/assets.md](docs/assets.md). The social preview image
`public/og-image.png` is a render of these models and carries the same licence.

## Modifications made by Dental Scope

- Selected the dental and oral subset; renamed meshes to Dental Scope IDs.
- Transformed to a Y-up, centimetre coordinate frame centred on the dentition.
- Simplified meshes (quadric decimation) and compressed them (meshopt).
- Derived the four third molars from the adjacent second molars.
- Partitioned alveolar bone, mandibular condyles and articular fossae from the source bones.
- Modeled internal tooth anatomy (enamel, dentin, cementum, periodontal ligament, pulp chamber, root canals) inside each tooth shape.
- Added schematic nerves, vessels and TMJ discs placed from computed landmarks.

## Software

- [three.js](https://threejs.org) — MIT
- [React](https://react.dev) — MIT
- [Zustand](https://github.com/pmndrs/zustand) — MIT
- [meshoptimizer](https://github.com/zeux/meshoptimizer) — MIT
- [glTF Transform](https://gltf-transform.dev) — MIT
- [trimesh](https://trimesh.org), [scikit-image](https://scikit-image.org), [SciPy](https://scipy.org), [NumPy](https://numpy.org), [fast-simplification](https://github.com/pyvista/fast-simplification) — MIT / BSD (pipeline only)

## Fonts

- [Inter Tight](https://fonts.google.com/specimen/Inter+Tight) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/) — SIL Open Font License 1.1

