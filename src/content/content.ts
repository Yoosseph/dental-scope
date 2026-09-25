/**
 * Educational content lookup. Content is data (JSON), separate from anatomy
 * and UI, so it can be replaced by verified sources without code changes.
 */
import type { Registry } from '../anatomy/registry';
import teeth from './en/teeth.json';
import structures from './en/structures.json';

export type ContentStatus = 'placeholder' | 'draft' | 'reviewed';

interface RawEntry {
  summary?: string;
  function?: string;
  clinical?: string;
  location?: string;
  facts?: { label: string; value: string }[];
  related?: string[];
  roots?: string;
  canals?: string;
  eruption?: string;
}

export interface ResolvedContent {
  key: string | null;
  summary?: string;
  function?: string;
  clinical?: string;
  facts: { label: string; value: string }[];
  related: string[];
  status: ContentStatus;
}

const DB: Record<string, RawEntry> = { ...(teeth as Record<string, RawEntry>), ...(structures as Record<string, RawEntry>) };
const STATUS: ContentStatus = 'draft';

/** Candidate content keys for a structure id, most specific first. */
export function contentKeys(registry: Registry, id: string): string[] {
  const s = registry.get(id);
  const keys: string[] = [];
  if (s?.tooth) keys.push(`tooth:${s.tooth.type}:${s.tooth.arch}`);
  let k = id;
  if (s?.toothFdi !== undefined) {
    k = k.replace(/-\d{2}$/, '');
    if (k.startsWith('canal-')) keys.push('canal');
    if (k.startsWith('apical-foramen')) keys.push('apical-foramen');
    if (k.startsWith('pulp-horn')) keys.push('pulp-horn');
  }
  keys.push(k);
  // strip trailing qualifiers: -right/-left, -superficial, -upper, …
  let parts = k.split('-');
  while (parts.length > 1) {
    parts = parts.slice(0, -1);
    keys.push(parts.join('-'));
  }
  return keys;
}

export function resolveContent(registry: Registry, id: string): ResolvedContent {
  const key = contentKeys(registry, id).find((k) => DB[k]) ?? null;
  const raw = key ? DB[key] : undefined;
  const s = registry.get(id);
  const facts = [...(raw?.facts ?? [])];
  if (raw?.roots) facts.push({ label: 'Typical roots', value: raw.roots });
  if (raw?.canals) facts.push({ label: 'Typical canals', value: raw.canals });
  if (raw?.eruption) facts.push({ label: 'Typical eruption', value: raw.eruption });
  const related = (raw?.related ?? [])
    .map((r) => resolveRelated(registry, r, id))
    .filter((r): r is string => !!r && r !== id && r !== s?.parent);
  return {
    key,
    summary: raw?.summary,
    function: raw?.function,
    clinical: raw?.clinical,
    facts,
    related: [...new Set(related)],
    status: raw ? STATUS : 'placeholder',
  };
}

function resolveRelated(registry: Registry, key: string, fromId: string): string | undefined {
  const s = registry.get(fromId);
  const fdi = s?.toothFdi;
  const side = /-(left|right)$/.exec(fromId)?.[1];
  const candidates: string[] = [];
  if (fdi !== undefined) {
    candidates.push(`${key}-${fdi}`);
    if (key === 'pulp-horn') candidates.push(`pulp-horn-1-${fdi}`);
    if (key === 'apical-foramen' || key === 'apex') {
      const af = registry.descendants(`tooth-${fdi}`).find((d) => d.id.startsWith(key === 'apex' ? 'apex-' : 'apical-foramen-'));
      if (af) candidates.push(af.id);
    }
  }
  if (key === 'alveolar-bone') candidates.push(fdi !== undefined && fdi < 30 ? 'maxillary-alveolar-process' : 'mandibular-alveolar-process');
  if (side) candidates.push(`${key}-${side}`);
  candidates.push(key, `${key}-right`);
  return candidates.find((c) => registry.get(c));
}
