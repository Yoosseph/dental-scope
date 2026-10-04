# Dentition development timeline

The bottom timeline has seven discrete teaching snapshots, from first primary
tooth eruption to young permanent dentition. Its final **Adult** stop restores
the existing adult atlas and the viewer's previous visibility settings. The app
opens at that adult stop.

**Play** starts growth immediately and moves continuously to Adult. Each segment
grows the skull and teeth over 1.9 seconds with no hold or slowdown at checkpoints.
The render clock carries time across segment boundaries. Pause freezes the
current growth pose and resumes from that pose. Seeking manually pauses playback;
replay from Adult starts at the first stage. Reset, unmount and a hidden browser
tab stop playback. Reduced-motion preferences keep instant snapshots.
In the normal view, position
and normal morph targets interpolate the surfaces on the GPU. Tooth buds grow
in, successors move toward the bite, and primary teeth shrink and fade away.
Interrupted transitions capture the displayed pose before seeking to a new one.
The blue timeline bar and thumb follow the same constant-speed growth progress
during playback, including pause and resume. Manual seeks retain eased transitions.
The last childhood stage grows towards the unchanged adult atlas geometry, then
crossfades to the normal adult tool. The camera follows growth smoothly and fits
actual surfaces rather than empty bounding-box corners for a closer starting view.

## 3D scene

Childhood stages show a complete, orbitable skull derived from the bundled adult
atlas. DevelopmentScene clones adult bone and supporting tissue meshes and
applies one shared, nonuniform spatial deformation. The cranium stays relatively
larger while facial height, width and depth grow across the illustrative stages.
Supporting tissues (gingiva, muscles, nerves, vessels and joint tissues) can be
shown together. These visuals are not selectable; the adult atlas retains its
normal picking, labels and dissection tools. Source adult geometry and its ray
acceleration trees are never changed or disposed by the developmental scene.

The scene uses 20 primary and 28 permanent tooth definitions. Primary molars use
resized adult molar templates at their successor premolar sites; other primary
teeth use resized corresponding adult crowns. Teeth are oriented using the
atlas cervical landmarks and tooth frames. Permanent successors are moved into
the jaws with shortened roots; eruption stages bring them towards the bite.
Third molars are outside these childhood snapshots. Primary teeth are gold,
unerupted crowns blue, emerging permanent teeth green, and erupted permanent
teeth ivory. Showing unerupted teeth makes the jaws transparent.

## Sources and limitations

- [AAPD Dental Growth and Development, 2025](https://www.aapd.org/globalassets/media/policies_guidelines/r_dentalgrowth25.pdf):
  eruption ranges and approximate onset of permanent tooth calcification.
- [StatPearls: Primary Dentition](https://www.ncbi.nlm.nih.gov/books/NBK573074/):
  primary tooth types and their anatomical relationships.
- [StatPearls: Tooth Eruption](https://www.ncbi.nlm.nih.gov/books/NBK549878/):
  succession and developing permanent teeth within the jaws.
- [Bastir, Rosas and O'Higgins, 2006](https://pubmed.ncbi.nlm.nih.gov/17062021/):
  different maturation patterns of the neurocranium, face and mandible.
  This supports the qualitative distinction, **not** our deformation coefficients.

Representative ages are 0.75, 2, 4, 6.5, 8.5, 10.5 and 13.5 years. Ages, bilateral
symmetry, predecessor removal at eruption onset, placements, shapes, root lengths
and craniofacial proportions are **schematic display conventions**, not fitted
pediatric anatomy. No age-specific pediatric imaging is bundled. Adult sutures
remain in the template; fontanelles, suture maturation and sinus growth are not
reconstructed. Primary tooth shape is approximate, not a measured primary-tooth
asset. These visual morphs do not model the biological trajectories between snapshots.
The model does not simulate histological mineralisation, physiological root resorption,
individual growth or dental age. Permanent crowns are omitted before the cited
approximate calcification onset. An erupted tooth need not have a complete root.

Every developmental content entry and all controls are available in English,
Swedish, German, Spanish and Latin. Content remains **draft** pending expert
review. Before adding anatomy, check sources and translations and run description
coverage tests and the production build.
