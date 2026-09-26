/**
 * Structure registry: the single source of truth for anatomy in the app.
 * Built once from the asset manifest + declarative tables.
 */
import { STRUCTURE_DEFS } from './structures';
import {
  PERMANENT_FDI,
  archOf,
  notationFor,
  sideOf,
  toothAliases,
  toothName,
  typeOf,
} from './notation';
import type { CategoryId, Manifest, ManifestMesh, RootInfo, Structure, Vec3 } from './types';

const QUADRANT_GROUP: Record<number, string> = {
  1: 'upper-right-quadrant',
  2: 'upper-left-quadrant',
  3: 'lower-left-quadrant',
  4: 'lower-right-quadrant',
};

const ROOT_NAME: Record<string, string> = {
  single: 'Root',
  mesial: 'Mesial root',
  distal: 'Distal root',
  buccal: 'Buccal root',
  palatal: 'Palatal root',
  lingual: 'Lingual root',
  mesiobuccal: 'Mesiobuccal root',
  distobuccal: 'Distobuccal root',
};

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export class Registry {
  readonly byId = new Map<string, Structure>();
  /** mesh key → owning (most specific) structure id */
  readonly meshOwner = new Map<string, string>();
  readonly manifest: Manifest;
  readonly rootId = 'dental-anatomy';

  constructor(manifest: Manifest) {
    this.manifest = manifest;
    this.buildStatic();
    this.buildTeeth();
    this.link();
  }

  /* ------------------------------------------------------------ build */

  private add(s: Structure) {
    if (this.byId.has(s.id)) throw new Error(`Duplicate structure id ${s.id}`);
    this.byId.set(s.id, s);
  }

  private meshInfo(key: string): ManifestMesh | undefined {
    return this.manifest.meshes[key];
  }

  private buildStatic() {
    for (const d of STRUCTURE_DEFS) {
      const meshes = (d.meshes ?? []).filter((m) => this.meshInfo(m));
      const kind = d.kind ?? (d.landmark ? 'landmark' : meshes.length ? 'mesh' : 'group');
      const info = meshes[0] ? this.meshInfo(meshes[0]) : undefined;
      this.add({
        id: d.id,
        name: d.name,
        kind,
        parent: d.parent,
        children: [],
        categories: d.categories ?? [],
        meshes,
        aliases: d.aliases ?? [],
        provenance: d.provenance ?? info?.provenance ?? 'source',
        sourceRef: info?.sourceRef,
        stage: info?.stage ?? 1,
        anchor: d.landmark ? this.manifest.landmarks[d.landmark] : undefined,
        labelPriority: d.labelPriority ?? 1,
        shortName: d.shortName,
      });
    }
  }

  private buildTeeth() {
    for (const fdi of PERMANENT_FDI) {
      const mt = this.manifest.teeth[String(fdi)];
      const notation = notationFor(fdi);
      const tId = `tooth-${fdi}`;
      const layers = mt?.layers ?? [];
      const has = (layer: string) => layers.includes(layer);
      const key = (layer: string) => `${layer}-${fdi}`;
      const cats = (c: CategoryId[]): CategoryId[] => ['permanent-teeth', ...c];
      const base = { toothFdi: fdi, stage: 4 as const, provenance: 'modeled' as const };
      const shellInfo = this.meshInfo(tId);
      const tName = toothName(fdi);

      // roots and canals (typical configuration derived by the pipeline)
      const roots: RootInfo[] = (mt?.roots ?? []).map((r) => ({
        label: r.label,
        canals: r.canals.map((c) => key(c)),
      }));

      this.add({
        id: tId,
        name: tName,
        kind: 'mesh',
        parent: QUADRANT_GROUP[Math.floor(fdi / 10)],
        children: [],
        categories: ['permanent-teeth'],
        meshes: shellInfo ? [tId] : [],
        aliases: [
          ...toothAliases(fdi),
          `tooth ${fdi}`,
          `tooth ${notation.universal}`,
          `#${notation.universal}`,
          notation.palmer,
          `fdi ${fdi}`,
          `universal ${notation.universal}`,
        ],
        provenance: mt?.provenance ?? 'source',
        sourceRef: shellInfo?.sourceRef,
        stage: 1,
        toothFdi: fdi,
        tooth: {
          fdi,
          notation,
          arch: archOf(fdi),
          side: sideOf(fdi),
          type: typeOf(fdi),
          dentition: 'permanent',
          roots,
          layers: layers.map(key),
          asset: mt?.asset,
          frame: mt?.frame,
        },
        labelPriority: 5,
      });

      if (!layers.length) continue;
      const ctx = [tName.toLowerCase(), `tooth ${fdi}`, `#${notation.universal}`];

      const region = (id: string, name: string, meshKeys: string[], aliases: string[]) =>
        this.add({ id, name, kind: 'region', parent: tId, children: [], categories: ['permanent-teeth'], meshes: meshKeys.filter((k) => layers.includes(k.replace(`-${fdi}`, ''))), aliases: [...aliases, ...ctx], labelPriority: 3, ...base });
      region(`crown-${fdi}`, 'Crown', [key('enamel'), key('dentin-coronal')], ['anatomical crown', 'crown']);
      region(`root-${fdi}`, roots.length > 1 ? 'Roots' : 'Root', [key('dentin-radicular'), key('cementum')], ['root', 'roots', 'radicular']);

      const mesh = (layer: string, name: string, parent: string, c: CategoryId[], aliases: string[], prio: number, shortName?: string) => {
        if (!has(layer)) return;
        this.add({ id: key(layer), name, kind: 'mesh', parent, children: [], categories: cats(c), meshes: [key(layer)], aliases: [...aliases, ...ctx], labelPriority: prio, shortName, ...base });
      };
      const group = (id: string, name: string, parent: string, c: CategoryId[], aliases: string[], prio: number) =>
        this.add({ id, name, kind: 'group', parent, children: [], categories: cats(c), meshes: [], aliases: [...aliases, ...ctx], labelPriority: prio, ...base });
      const landmark = (id: string, name: string, parent: string, c: CategoryId[], aliases: string[], anchor: Vec3, prio: number, shortName: string) =>
        this.add({ id, name, kind: 'landmark', parent, children: [], categories: cats(c), meshes: [], aliases: [...aliases, ...ctx], anchor, labelPriority: prio, shortName, ...base });

      mesh('enamel', 'Enamel', tId, ['enamel'], ['enamel', 'tooth enamel', 'enamel cap'], 4);
      group(`dentin-${fdi}`, 'Dentin', tId, ['dentin'], ['dentin', 'dentine'], 4);
      mesh('dentin-coronal', 'Coronal dentin', `dentin-${fdi}`, ['dentin'], ['dentin', 'crown dentin'], 3);
      mesh('dentin-radicular', 'Radicular dentin', `dentin-${fdi}`, ['dentin'], ['dentin', 'root dentin'], 3);
      mesh('cementum', 'Cementum', tId, ['cementum'], ['cementum', 'root surface'], 3);
      group(`pulp-${fdi}`, 'Dental pulp', tId, ['dental-pulp'], ['pulp', 'nerve of the tooth', 'pulp tissue'], 4);
      mesh('pulp-chamber', 'Pulp chamber', `pulp-${fdi}`, ['dental-pulp'], ['pulp chamber', 'coronal pulp', 'pulp'], 4);
      mesh('pdl', 'Periodontal ligament', tId, ['periodontal-ligament'], ['pdl', 'periodontal ligament', 'periodontal membrane'], 2, 'PDL');

      // canals
      const canalIds = roots.flatMap((r) => r.canals);
      if (canalIds.length) group(`root-canals-${fdi}`, canalIds.length > 1 ? 'Root canals' : 'Root canal', `pulp-${fdi}`, ['dental-pulp', 'root-canals'], ['root canal', 'root canals', 'canal system', 'radicular pulp'], 3);
      const frame = mt.frame;
      for (const r of mt.roots ?? []) {
        const nCanals = r.canals.length;
        // order canals buccal → lingual using apical foramen landmarks
        const withPos = r.canals.map((c) => {
          const lm = mt.landmarks?.[`apical-foramen-${c.replace('canal-', '')}`];
          const b = lm && frame ? dot(sub(lm, frame.origin), frame.buccal) : 0;
          return { c, lm, b };
        });
        withPos.sort((a, b) => b.b - a.b);
        withPos.forEach(({ c, lm }, i) => {
          const nm = canalName(r.label, nCanals, i, archOf(fdi));
          mesh(c, nm.name, `root-canals-${fdi}`, ['dental-pulp', 'root-canals'], ['root canal', 'canal', nm.abbr.toLowerCase(), `${r.label} canal`], 3, nm.abbr);
          if (lm) {
            landmark(`apical-foramen-${c.replace('canal-', '')}-${fdi}`, `Apical foramen (${nm.abbr})`, key(c), ['dental-pulp', 'root-canals'], ['apical foramen', 'apex', 'foramen'], lm, 2, 'Apical foramen');
          }
        });
      }
      // landmarks
      for (const [lk, p] of Object.entries(mt.landmarks ?? {})) {
        if (lk.startsWith('pulp-horn-')) {
          landmark(`${lk}-${fdi}`, `Pulp horn ${lk.slice(10)}`, key('pulp-chamber'), ['dental-pulp'], ['pulp horn', 'pulp horns'], p, 1, 'Pulp horn');
        }
      }
      if (mt.landmarks?.['cervical-line']) {
        landmark(`cej-${fdi}`, 'Cementoenamel junction', tId, [], ['cej', 'cervical line', 'neck of tooth', 'cementoenamel junction'], mt.landmarks['cervical-line'], 2, 'CEJ');
      }
      if (mt.landmarks?.apex) {
        landmark(`apex-${fdi}`, 'Root apex', `root-${fdi}`, [], ['apex', 'root apex', 'root tip'], mt.landmarks.apex, 1, 'Apex');
      }
      // label for root structure
      const rootStruct = this.byId.get(`root-${fdi}`);
      if (rootStruct && roots.length > 1) rootStruct.aliases.push(...roots.map((r) => ROOT_NAME[r.label]?.toLowerCase() ?? r.label));
    }
  }

  private link() {
    for (const s of this.byId.values()) {
      if (s.parent) {
        const p = this.byId.get(s.parent);
        if (!p) throw new Error(`Missing parent ${s.parent} for ${s.id}`);
        p.children.push(s.id);
      }
      if (s.kind === 'mesh') for (const m of s.meshes) this.meshOwner.set(m, s.id);
    }
    // structures with multiple meshes where one is also its own id (e.g. mental-nerve branches)
    for (const s of this.byId.values()) for (const m of s.meshes) if (!this.meshOwner.has(m)) this.meshOwner.set(m, s.id);
  }

  /* ------------------------------------------------------------ queries */

  get(id: string): Structure | undefined {
    return this.byId.get(id);
  }

  require(id: string): Structure {
    const s = this.byId.get(id);
    if (!s) throw new Error(`Unknown structure ${id}`);
    return s;
  }

  ancestors(id: string): Structure[] {
    const out: Structure[] = [];
    let cur = this.byId.get(id)?.parent;
    while (cur) {
      const s = this.byId.get(cur);
      if (!s) break;
      out.push(s);
      cur = s.parent;
    }
    return out;
  }

  descendants(id: string): Structure[] {
    const out: Structure[] = [];
    const stack = [...(this.byId.get(id)?.children ?? [])];
    while (stack.length) {
      const s = this.byId.get(stack.pop()!)!;
      out.push(s);
      stack.push(...s.children);
    }
    return out;
  }

  isDescendant(id: string, ancestorId: string): boolean {
    if (id === ancestorId) return true;
    return this.ancestors(id).some((a) => a.id === ancestorId);
  }

  /** All mesh keys a structure resolves to (own + descendants). */
  meshesOf(id: string): string[] {
    const s = this.byId.get(id);
    if (!s) return [];
    const set = new Set(s.meshes);
    for (const d of this.descendants(id)) for (const m of d.meshes) set.add(m);
    return [...set];
  }

  categoriesOfMesh(meshKey: string): CategoryId[] {
    const owner = this.meshOwner.get(meshKey);
    if (!owner) return [];
    const s = this.byId.get(owner)!;
    // inherit categories from ancestors for structures that declare none
    if (s.categories.length) return s.categories;
    for (const a of this.ancestors(owner)) if (a.categories.length) return a.categories;
    return [];
  }

  countByCategory(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [mesh] of this.meshOwner) {
      for (const c of this.categoriesOfMesh(mesh)) counts[c] = (counts[c] ?? 0) + 1;
    }
    // tooth layers not yet loaded still count (they are listed in the manifest)
    return counts;
  }

  teeth(): Structure[] {
    return PERMANENT_FDI.map((f) => this.byId.get(`tooth-${f}`)!).filter(Boolean);
  }
}

function canalName(root: string, n: number, i: number, arch: 'maxillary' | 'mandibular'): { name: string; abbr: string } {
  if (root === 'single') return { name: 'Root canal', abbr: 'Canal' };
  if (n === 1) {
    const nm = ROOT_NAME[root]?.replace('root', 'canal') ?? `${root} canal`;
    const abbr = { mesial: 'M', distal: 'D', buccal: 'B', palatal: 'P', lingual: 'L', mesiobuccal: 'MB', distobuccal: 'DB' }[root] ?? root;
    return { name: nm, abbr };
  }
  if (root === 'mesiobuccal') return i === 0 ? { name: 'Mesiobuccal canal (MB1)', abbr: 'MB1' } : { name: 'Second mesiobuccal canal (MB2)', abbr: 'MB2' };
  if (root === 'mesial') return i === 0 ? { name: 'Mesiobuccal canal', abbr: 'MB' } : { name: 'Mesiolingual canal', abbr: 'ML' };
  if (root === 'distal') return i === 0 ? { name: 'Distobuccal canal', abbr: 'DB' } : { name: 'Distolingual canal', abbr: 'DL' };
  const lingual = arch === 'maxillary' ? 'palatal' : 'lingual';
  return i === 0 ? { name: 'Buccal canal', abbr: 'B' } : { name: `${lingual[0].toUpperCase()}${lingual.slice(1)} canal`, abbr: lingual[0].toUpperCase() };
}
