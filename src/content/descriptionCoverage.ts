import type { Registry } from '../anatomy/registry.ts';
import { LANGS } from '../i18n/lang.ts';
import { CONTENT, resolveContent } from './content.ts';
import { STRUCTURE_DEFS } from '../anatomy/structures.ts';

/** Do not publish new selectable anatomy without descriptions in every supported language. */
export function descriptionGaps(registry: Registry): string[] {
  const gaps = [...registry.byId.values()].flatMap((s) => LANGS.flatMap((lang) => {
    const content = resolveContent(registry, s.id, lang);
    return content.summary?.trim() && content.key && CONTENT[lang][content.key]?.summary?.trim() ? [] : [`${lang}: ${s.id}`];
  }));
  // A newly named atlas part must have its own text, rather than silently
  // inheriting an unrelated parent because its id happens to share a prefix.
  for (const def of STRUCTURE_DEFS) {
    const key = def.id.replace(/-(right|left)$/, '');
    for (const lang of LANGS) if (!CONTENT[lang][key]?.summary?.trim()) gaps.push(`${lang}: ${def.id} requires its own content entry (${key})`);
  }
  return [...new Set(gaps)];
}
