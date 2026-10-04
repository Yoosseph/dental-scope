# Anatomy content requirements

Never add selectable anatomy without a meaningful description in every supported language (English, Swedish, German, Spanish and Latin). New named structures and atlas parts need their own content entry; paired left/right structures may share one entry. Generated tooth layers may share their tissue description.

Describe location and anatomical relationships, with function where relevant. Cite medical sources for new anatomical claims, distinguish schematic examples from measured anatomy, and retain draft status until expert review.

Run the description coverage tests and production build after adding anatomy or changing content resolution. `src/content/descriptionCoverage.ts` enforces this requirement in both tests and the Vite build. Do not bypass that guard or substitute generic filler text.

Keep changes within the existing registry, content, state, engine and UI architecture.
