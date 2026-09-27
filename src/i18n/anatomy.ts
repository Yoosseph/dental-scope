/**
 * Anatomical names in every interface language. The registry stores each
 * structure's name per language (Structure.names) using these tables; the
 * English names stay the reference (Structure.name).
 *
 * Swedish and German follow the terms used in dental education in each country:
 * native terms where they are standard (Överkäke / Oberkiefer, Emalj / Zahnschmelz),
 * Latin (Terminologia Anatomica) for nerves, vessels and muscles.
 * Imported by the build (about page), so imports carry their .ts extension.
 */
import type { Arch, Side, ToothType } from '../anatomy/types.ts';
import type { Lang } from './lang.ts';

export type Names = Record<Lang, string>;
type Tr = { sv: string; de: string };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ teeth */

export const TYPE_NAMES: Record<Lang, Record<ToothType, string>> = {
  en: {
    'central-incisor': 'central incisor',
    'lateral-incisor': 'lateral incisor',
    canine: 'canine',
    'first-premolar': 'first premolar',
    'second-premolar': 'second premolar',
    'first-molar': 'first molar',
    'second-molar': 'second molar',
    'third-molar': 'third molar',
  },
  sv: {
    'central-incisor': 'central incisiv',
    'lateral-incisor': 'lateral incisiv',
    canine: 'hörntand',
    'first-premolar': 'första premolar',
    'second-premolar': 'andra premolar',
    'first-molar': 'första molar',
    'second-molar': 'andra molar',
    'third-molar': 'tredje molar',
  },
  de: {
    'central-incisor': 'Mittlerer Schneidezahn',
    'lateral-incisor': 'Seitlicher Schneidezahn',
    canine: 'Eckzahn',
    'first-premolar': 'Erster Prämolar',
    'second-premolar': 'Zweiter Prämolar',
    'first-molar': 'Erster Molar',
    'second-molar': 'Zweiter Molar',
    'third-molar': 'Dritter Molar',
  },
};

/** Plural headings for the tooth types ("Central incisors"). */
export const TYPE_PLURALS: Record<Lang, Record<ToothType, string>> = {
  en: {
    'central-incisor': 'Central incisors',
    'lateral-incisor': 'Lateral incisors',
    canine: 'Canines',
    'first-premolar': 'First premolars',
    'second-premolar': 'Second premolars',
    'first-molar': 'First molars',
    'second-molar': 'Second molars',
    'third-molar': 'Third molars',
  },
  sv: {
    'central-incisor': 'Centrala incisiver',
    'lateral-incisor': 'Laterala incisiver',
    canine: 'Hörntänder',
    'first-premolar': 'Första premolarer',
    'second-premolar': 'Andra premolarer',
    'first-molar': 'Första molarer',
    'second-molar': 'Andra molarer',
    'third-molar': 'Tredje molarer',
  },
  de: {
    'central-incisor': 'Mittlere Schneidezähne',
    'lateral-incisor': 'Seitliche Schneidezähne',
    canine: 'Eckzähne',
    'first-premolar': 'Erste Prämolaren',
    'second-premolar': 'Zweite Prämolaren',
    'first-molar': 'Erste Molaren',
    'second-molar': 'Zweite Molaren',
    'third-molar': 'Dritte Molaren',
  },
};

/** Tooth type alone, capitalised ("First molar", "Första molar", "Erster Molar"). */
export function typeLabel(type: ToothType, lang: Lang): string {
  return cap(TYPE_NAMES[lang][type]);
}

/** Tooth type in one arch, no side ("Maxillary first molar"). */
export function archTypeName(type: ToothType, arch: Arch, lang: Lang): string {
  const t = TYPE_NAMES[lang][type];
  if (lang === 'sv') return cap(`${t} i ${arch === 'maxillary' ? 'överkäken' : 'underkäken'}`);
  if (lang === 'de') return `${t} im ${arch === 'maxillary' ? 'Oberkiefer' : 'Unterkiefer'}`;
  return cap(`${arch} ${t}`);
}

/** Full tooth name ("Mandibular left first molar"). */
export function toothNameIn(type: ToothType, arch: Arch, side: Side, lang: Lang): string {
  const t = TYPE_NAMES[lang][type];
  if (lang === 'sv') return `${side === 'right' ? 'Höger' : 'Vänster'} ${t} i ${arch === 'maxillary' ? 'överkäken' : 'underkäken'}`;
  if (lang === 'de') return `${t} im ${arch === 'maxillary' ? 'Oberkiefer' : 'Unterkiefer'} ${side === 'right' ? 'rechts' : 'links'}`;
  return cap(`${arch} ${side} ${t}`);
}

/** Everyday search terms for a tooth in Swedish and German (the English ones are in notation.ts). */
export function toothSearchAliases(type: ToothType, arch: Arch, fdi: number): string[] {
  const up = arch === 'maxillary';
  const sv = TYPE_NAMES.sv[type];
  const de = TYPE_NAMES.de[type];
  const out = [
    `${sv} i ${up ? 'överkäken' : 'underkäken'}`,
    `${up ? 'övre' : 'nedre'} ${sv}`,
    sv,
    `tand ${fdi}`,
    `${de} im ${up ? 'Oberkiefer' : 'Unterkiefer'}`,
    `${up ? 'oberer' : 'unterer'} ${de}`,
    de,
    `zahn ${fdi}`,
  ];
  const extra: Partial<Record<ToothType, string[]>> = {
    'central-incisor': ['framtand', 'mittre framtand', 'incisiv', 'Frontzahn', 'Schneidezahn', 'Inzisivus'],
    'lateral-incisor': ['framtand', 'incisiv', 'Frontzahn', 'Schneidezahn', 'Inzisivus'],
    canine: ['kanin', 'hörntand', 'Caninus', 'Eckzahn'],
    'first-premolar': ['premolar', 'kindtand', 'Prämolar', 'vorderer Backenzahn'],
    'second-premolar': ['premolar', 'kindtand', 'Prämolar', 'vorderer Backenzahn'],
    'first-molar': ['sexårsmolar', 'molar', 'kindtand', 'Sechsjahrmolar', 'Molar', 'Backenzahn', 'Mahlzahn'],
    'second-molar': ['tolvårsmolar', 'molar', 'kindtand', 'Zwölfjahrmolar', 'Molar', 'Backenzahn', 'Mahlzahn'],
    'third-molar': ['visdomstand', 'visdomständer', 'molar', 'Weisheitszahn', 'Weisheitszähne', 'Molar'],
  };
  return [...out, ...(extra[type] ?? [])];
}

/* ------------------------------------------------------------------ tooth parts */

export type PartKey =
  | 'crown'
  | 'root'
  | 'roots'
  | 'enamel'
  | 'dentin'
  | 'dentin-coronal'
  | 'dentin-radicular'
  | 'cementum'
  | 'pulp'
  | 'pulp-chamber'
  | 'pdl'
  | 'root-canal'
  | 'root-canals'
  | 'cej'
  | 'apex';

export const PART_NAMES: Record<Lang, Record<PartKey, string>> = {
  en: {
    crown: 'Crown',
    root: 'Root',
    roots: 'Roots',
    enamel: 'Enamel',
    dentin: 'Dentin',
    'dentin-coronal': 'Coronal dentin',
    'dentin-radicular': 'Radicular dentin',
    cementum: 'Cementum',
    pulp: 'Dental pulp',
    'pulp-chamber': 'Pulp chamber',
    pdl: 'Periodontal ligament',
    'root-canal': 'Root canal',
    'root-canals': 'Root canals',
    cej: 'Cementoenamel junction',
    apex: 'Root apex',
  },
  sv: {
    crown: 'Krona',
    root: 'Rot',
    roots: 'Rötter',
    enamel: 'Emalj',
    dentin: 'Dentin',
    'dentin-coronal': 'Koronalt dentin',
    'dentin-radicular': 'Radikulärt dentin',
    cementum: 'Rotcement',
    pulp: 'Pulpa',
    'pulp-chamber': 'Pulpakammare',
    pdl: 'Parodontalligament',
    'root-canal': 'Rotkanal',
    'root-canals': 'Rotkanaler',
    cej: 'Emalj-cementgränsen',
    apex: 'Rotspets',
  },
  de: {
    crown: 'Krone',
    root: 'Wurzel',
    roots: 'Wurzeln',
    enamel: 'Zahnschmelz',
    dentin: 'Dentin',
    'dentin-coronal': 'Koronales Dentin',
    'dentin-radicular': 'Radikuläres Dentin',
    cementum: 'Wurzelzement',
    pulp: 'Zahnpulpa',
    'pulp-chamber': 'Pulpakammer',
    pdl: 'Desmodont',
    'root-canal': 'Wurzelkanal',
    'root-canals': 'Wurzelkanäle',
    cej: 'Schmelz-Zement-Grenze',
    apex: 'Wurzelspitze',
  },
};

export const partNames = (k: PartKey): Names => ({ en: PART_NAMES.en[k], sv: PART_NAMES.sv[k], de: PART_NAMES.de[k] });

/** Short 3D-label names of tooth parts. */
export const PART_SHORT: Record<Lang, Record<'pdl' | 'cej' | 'apex' | 'apical-foramen' | 'pulp-horn' | 'canal', string>> = {
  en: { pdl: 'PDL', cej: 'CEJ', apex: 'Apex', 'apical-foramen': 'Apical foramen', 'pulp-horn': 'Pulp horn', canal: 'Canal' },
  sv: { pdl: 'PDL', cej: 'ECG', apex: 'Apex', 'apical-foramen': 'Foramen apicale', 'pulp-horn': 'Pulpahorn', canal: 'Kanal' },
  de: { pdl: 'Desmodont', cej: 'SZG', apex: 'Apex', 'apical-foramen': 'Foramen apicale', 'pulp-horn': 'Pulpahorn', canal: 'Kanal' },
};
export const partShort = (k: keyof (typeof PART_SHORT)['en']): Names => ({ en: PART_SHORT.en[k], sv: PART_SHORT.sv[k], de: PART_SHORT.de[k] });

export const pulpHornNames = (n: string): Names => ({ en: `Pulp horn ${n}`, sv: `Pulpahorn ${n}`, de: `Pulpahorn ${n}` });
export const apicalForamenNames = (abbr: Names): Names => ({
  en: `Apical foramen (${abbr.en})`,
  sv: `Foramen apicale (${abbr.sv})`,
  de: `Foramen apicale (${abbr.de})`,
});

/** Search terms for tooth parts in Swedish and German, by part. */
export const PART_ALIASES: Record<string, string[]> = {
  crown: ['krona', 'tandkrona', 'Krone', 'Zahnkrone'],
  root: ['rot', 'rötter', 'tandrot', 'Wurzel', 'Wurzeln', 'Zahnwurzel'],
  enamel: ['emalj', 'tandemalj', 'Schmelz', 'Zahnschmelz'],
  dentin: ['dentin', 'Dentin', 'Zahnbein'],
  cementum: ['cement', 'rotcement', 'Zement', 'Wurzelzement'],
  pulp: ['pulpa', 'tandpulpa', 'tandnerv', 'nerven i tanden', 'Pulpa', 'Zahnpulpa', 'Zahnmark', 'Zahnnerv'],
  'pulp-chamber': ['pulpakammare', 'Pulpakammer', 'Pulpenkavum'],
  pdl: ['rothinna', 'parodontalligament', 'Desmodont', 'Wurzelhaut', 'parodontales Ligament'],
  'root-canals': ['rotkanal', 'rotkanaler', 'kanal', 'Wurzelkanal', 'Wurzelkanäle', 'Kanal'],
  canal: ['rotkanal', 'kanal', 'Wurzelkanal', 'Kanal'],
  'apical-foramen': ['foramen apicale', 'rotspets', 'Foramen apicale', 'Wurzelspitze'],
  'pulp-horn': ['pulpahorn', 'Pulpahorn'],
  cej: ['ECG', 'emalj-cementgräns', 'emalj-cementgränsen', 'tandhals', 'SZG', 'Schmelz-Zement-Grenze', 'Zahnhals'],
  apex: ['apex', 'rotspets', 'Apex', 'Wurzelspitze'],
};

/* ------------------------------------------------------------------ root canals */

const ROOT_WORD: Record<string, Tr> = {
  mesial: { sv: 'Mesial', de: 'Mesiale' },
  distal: { sv: 'Distal', de: 'Distale' },
  buccal: { sv: 'Buckal', de: 'Bukkale' },
  palatal: { sv: 'Palatinal', de: 'Palatinale' },
  lingual: { sv: 'Lingual', de: 'Linguale' },
  mesiobuccal: { sv: 'Mesiobuckal', de: 'Mesiobukkale' },
  distobuccal: { sv: 'Distobuckal', de: 'Distobukkale' },
};

/** Root names by root label ("Mesial root"). */
export function rootNames(label: string): Names | undefined {
  if (label === 'single') return partNames('root');
  const w = ROOT_WORD[label];
  if (!w) return undefined;
  return { en: `${cap(label)} root`, sv: `${w.sv} rot`, de: `${w.de} Wurzel` };
}

/** German adjective ending for a masculine noun (der Kanal): "Mesiale" → "Mesialer". */
const deMasc = (adj: string) => adj.replace(/e$/, 'er');

/**
 * Name and abbreviation of a root canal, given its root, the number of canals in that root,
 * its index (buccal first) and the arch.
 */
export function canalNames(root: string, n: number, i: number, arch: Arch): { names: Names; abbr: Names } {
  const same = (a: string): Names => ({ en: a, sv: a, de: a });
  const canal = (en: string, sv: string, de: string, abbr: string) => ({ names: { en, sv, de }, abbr: same(abbr) });
  if (root === 'single') return { names: partNames('root-canal'), abbr: partShort('canal') };
  if (n === 1) {
    const w = ROOT_WORD[root];
    const abbr = { mesial: 'M', distal: 'D', buccal: 'B', palatal: 'P', lingual: 'L', mesiobuccal: 'MB', distobuccal: 'DB' }[root] ?? root;
    if (!w) return canal(`${root} canal`, `${root} kanal`, `${root} Kanal`, abbr);
    return canal(`${cap(root)} canal`, `${w.sv} kanal`, `${deMasc(w.de)} Kanal`, abbr);
  }
  if (root === 'mesiobuccal')
    return i === 0
      ? canal('Mesiobuccal canal (MB1)', 'Mesiobuckal kanal (MB1)', 'Mesiobukkaler Kanal (MB1)', 'MB1')
      : canal('Second mesiobuccal canal (MB2)', 'Andra mesiobuckala kanalen (MB2)', 'Zweiter mesiobukkaler Kanal (MB2)', 'MB2');
  if (root === 'mesial')
    return i === 0 ? canal('Mesiobuccal canal', 'Mesiobuckal kanal', 'Mesiobukkaler Kanal', 'MB') : canal('Mesiolingual canal', 'Mesiolingual kanal', 'Mesiolingualer Kanal', 'ML');
  if (root === 'distal')
    return i === 0 ? canal('Distobuccal canal', 'Distobuckal kanal', 'Distobukkaler Kanal', 'DB') : canal('Distolingual canal', 'Distolingual kanal', 'Distolingualer Kanal', 'DL');
  if (i === 0) return canal('Buccal canal', 'Buckal kanal', 'Bukkaler Kanal', 'B');
  return arch === 'maxillary' ? canal('Palatal canal', 'Palatinal kanal', 'Palatinaler Kanal', 'P') : canal('Lingual canal', 'Lingual kanal', 'Lingualer Kanal', 'L');
}

/* ------------------------------------------------------------------ other structures */

/** Names by exact structure id. */
const EXACT: Record<string, Tr> = {
  'dental-anatomy': { sv: 'Tandanatomi', de: 'Zahnanatomie' },
  maxilla: { sv: 'Överkäke', de: 'Oberkiefer' },
  'maxillary-alveolar-process': { sv: 'Överkäkens alveolarutskott', de: 'Alveolarfortsatz des Oberkiefers' },
  'maxillary-dentition': { sv: 'Överkäkens tandbåge', de: 'Oberer Zahnbogen' },
  'upper-right-quadrant': { sv: 'Övre högra kvadranten', de: 'Oberer rechter Quadrant' },
  'upper-left-quadrant': { sv: 'Övre vänstra kvadranten', de: 'Oberer linker Quadrant' },
  'lower-left-quadrant': { sv: 'Nedre vänstra kvadranten', de: 'Unterer linker Quadrant' },
  'lower-right-quadrant': { sv: 'Nedre högra kvadranten', de: 'Unterer rechter Quadrant' },
  mandible: { sv: 'Underkäke', de: 'Unterkiefer' },
  'mandible-body': { sv: 'Underkäkens kropp och grenar', de: 'Unterkieferkörper und Unterkieferäste' },
  'mandibular-alveolar-process': { sv: 'Underkäkens alveolarutskott', de: 'Alveolarfortsatz des Unterkiefers' },
  'mandibular-dentition': { sv: 'Underkäkens tandbåge', de: 'Unterer Zahnbogen' },
  periodontium: { sv: 'Parodontium', de: 'Parodontium' },
  gingiva: { sv: 'Gingiva', de: 'Gingiva' },
  'gingiva-upper': { sv: 'Gingiva i överkäken', de: 'Gingiva des Oberkiefers' },
  'gingiva-lower': { sv: 'Gingiva i underkäken', de: 'Gingiva des Unterkiefers' },
  neurovascular: { sv: 'Nerver och kärl', de: 'Nerven und Gefäße' },
  nerves: { sv: 'Nerver', de: 'Nerven' },
  'mandibular-nerve-branches': { sv: 'Grenar av n. mandibularis (V3)', de: 'Äste des N. mandibularis (V3)' },
  'maxillary-nerve-branches': { sv: 'Grenar av n. maxillaris (V2)', de: 'Äste des N. maxillaris (V2)' },
  vessels: { sv: 'Blodkärl', de: 'Blutgefäße' },
  'arterial-supply': { sv: 'Artärer', de: 'Arterien' },
  'venous-drainage': { sv: 'Vener', de: 'Venen' },
  tmj: { sv: 'Käklederna', de: 'Kiefergelenke' },
  skull: { sv: 'Skalle (kontext)', de: 'Schädel (Kontext)' },
  'frontal-bone': { sv: 'Pannben', de: 'Stirnbein' },
  'occipital-bone': { sv: 'Nackben', de: 'Hinterhauptsbein' },
  'sphenoid-bone': { sv: 'Kilben', de: 'Keilbein' },
  'ethmoid-bone': { sv: 'Silben', de: 'Siebbein' },
  vomer: { sv: 'Plogben', de: 'Pflugscharbein' },
  'hyoid-bone': { sv: 'Tungben', de: 'Zungenbein' },
  muscles: { sv: 'Tuggmuskler och muskler runt munnen', de: 'Kaumuskeln und Muskeln um den Mund' },
  'orbicularis-oris': { sv: 'Musculus orbicularis oris', de: 'Musculus orbicularis oris' },
};

/** Names of paired structures by base id (the id without -right / -left); the side follows in brackets. */
const SIDED: Record<string, Tr> = {
  maxilla: { sv: 'Maxilla', de: 'Maxilla' },
  'maxillary-alveolar-process': { sv: 'Överkäkens alveolarutskott', de: 'Alveolarfortsatz des Oberkiefers' },
  'mandibular-condyle': { sv: 'Underkäkens ledhuvud', de: 'Unterkieferköpfchen' },
  'mandibular-foramen': { sv: 'Foramen mandibulae', de: 'Foramen mandibulae' },
  'mental-foramen': { sv: 'Foramen mentale', de: 'Foramen mentale' },
  'inferior-alveolar-nerve': { sv: 'Nervus alveolaris inferior', de: 'Nervus alveolaris inferior' },
  'mental-nerve': { sv: 'Nervus mentalis', de: 'Nervus mentalis' },
  'incisive-nerve': { sv: 'Nervus incisivus', de: 'Nervus incisivus' },
  'lingual-nerve': { sv: 'Nervus lingualis', de: 'Nervus lingualis' },
  'infraorbital-nerve': { sv: 'Nervus infraorbitalis', de: 'Nervus infraorbitalis' },
  'posterior-superior-alveolar-nerve': { sv: 'Rami alveolares superiores posteriores', de: 'Rami alveolares superiores posteriores' },
  'middle-superior-alveolar-nerve': { sv: 'Ramus alveolaris superior medius', de: 'Ramus alveolaris superior medius' },
  'anterior-superior-alveolar-nerve': { sv: 'Rami alveolares superiores anteriores', de: 'Rami alveolares superiores anteriores' },
  'inferior-alveolar-artery': { sv: 'Arteria alveolaris inferior', de: 'Arteria alveolaris inferior' },
  'inferior-alveolar-vein': { sv: 'Vena alveolaris inferior', de: 'Vena alveolaris inferior' },
  'trigeminal-nerve': { sv: 'Nervus trigeminus (V)', de: 'Nervus trigeminus (V)' },
  'mandibular-nerve': { sv: 'Nervus mandibularis (V3)', de: 'Nervus mandibularis (V3)' },
  'maxillary-nerve': { sv: 'Nervus maxillaris (V2)', de: 'Nervus maxillaris (V2)' },
  'buccal-nerve': { sv: 'Nervus buccalis', de: 'Nervus buccalis' },
  'external-carotid-artery': { sv: 'Arteria carotis externa', de: 'Arteria carotis externa' },
  'maxillary-artery': { sv: 'Arteria maxillaris', de: 'Arteria maxillaris' },
  'posterior-superior-alveolar-artery': { sv: 'Arteria alveolaris superior posterior', de: 'Arteria alveolaris superior posterior' },
  'descending-palatine-artery': { sv: 'Arteria palatina descendens', de: 'Arteria palatina descendens' },
  'buccal-artery': { sv: 'Arteria buccalis', de: 'Arteria buccalis' },
  'facial-artery': { sv: 'Arteria facialis', de: 'Arteria facialis' },
  'pterygoid-plexus': { sv: 'Plexus pterygoideus', de: 'Plexus pterygoideus' },
  'maxillary-vein': { sv: 'Vena maxillaris', de: 'Vena maxillaris' },
  'retromandibular-vein': { sv: 'Vena retromandibularis', de: 'Vena retromandibularis' },
  'facial-vein': { sv: 'Vena facialis', de: 'Vena facialis' },
  'internal-jugular-vein': { sv: 'Vena jugularis interna', de: 'Vena jugularis interna' },
  'external-jugular-vein': { sv: 'Vena jugularis externa', de: 'Vena jugularis externa' },
  tmj: { sv: 'Käkled', de: 'Kiefergelenk' },
  'articular-disc': { sv: 'Ledskiva', de: 'Discus articularis' },
  'articular-fossa': { sv: 'Fossa mandibularis', de: 'Fossa mandibularis' },
  'temporal-bone': { sv: 'Tinningben', de: 'Schläfenbein' },
  'zygomatic-bone': { sv: 'Okben', de: 'Jochbein' },
  'palatine-bone': { sv: 'Gomben', de: 'Gaumenbein' },
  'parietal-bone': { sv: 'Hjässben', de: 'Scheitelbein' },
  'nasal-bone': { sv: 'Näsben', de: 'Nasenbein' },
  'lacrimal-bone': { sv: 'Tårben', de: 'Tränenbein' },
  'inferior-nasal-concha': { sv: 'Nedre näsmussla', de: 'Untere Nasenmuschel' },
  masseter: { sv: 'Musculus masseter', de: 'Musculus masseter' },
  'masseter-superficial': { sv: 'M. masseter, ytlig del', de: 'M. masseter, oberflächlicher Anteil' },
  'masseter-deep': { sv: 'M. masseter, djup del', de: 'M. masseter, tiefer Anteil' },
  'lateral-pterygoid': { sv: 'Musculus pterygoideus lateralis', de: 'Musculus pterygoideus lateralis' },
  'lateral-pterygoid-upper': { sv: 'M. pterygoideus lateralis, övre huvud', de: 'M. pterygoideus lateralis, oberer Kopf' },
  'lateral-pterygoid-lower': { sv: 'M. pterygoideus lateralis, nedre huvud', de: 'M. pterygoideus lateralis, unterer Kopf' },
  temporalis: { sv: 'Musculus temporalis', de: 'Musculus temporalis' },
  'medial-pterygoid': { sv: 'Musculus pterygoideus medialis', de: 'Musculus pterygoideus medialis' },
  buccinator: { sv: 'Musculus buccinator', de: 'Musculus buccinator' },
  mentalis: { sv: 'Musculus mentalis', de: 'Musculus mentalis' },
};

const SIDE_WORD: Record<Side, Tr> = { right: { sv: 'höger', de: 'rechts' }, left: { sv: 'vänster', de: 'links' } };

/** Names of a non-tooth structure; English comes from its definition. Undefined when a translation is missing. */
export function structureNames(id: string, en: string): Names | undefined {
  const exact = EXACT[id];
  if (exact) return { en, ...exact };
  const m = /^(.*)-(right|left)$/.exec(id);
  const sided = m ? SIDED[m[1]] : undefined;
  if (!m || !sided) return undefined;
  const side = SIDE_WORD[m[2] as Side];
  return { en, sv: `${sided.sv} (${side.sv})`, de: `${sided.de} (${side.de})` };
}

/** Short 3D-label names of non-tooth structures, where English has one (by base id). */
export const STRUCTURE_SHORT: Record<string, Tr> = {
  'inferior-alveolar-nerve': { sv: 'N. alv. inf.', de: 'N. alv. inf.' },
  'posterior-superior-alveolar-nerve': { sv: 'Rr. alv. sup. post.', de: 'Rr. alv. sup. post.' },
  'middle-superior-alveolar-nerve': { sv: 'R. alv. sup. med.', de: 'R. alv. sup. med.' },
  'anterior-superior-alveolar-nerve': { sv: 'Rr. alv. sup. ant.', de: 'Rr. alv. sup. ant.' },
  'trigeminal-nerve': { sv: 'N. V', de: 'N. V' },
  'mandibular-nerve': { sv: 'V3', de: 'V3' },
  'maxillary-nerve': { sv: 'V2', de: 'V2' },
};

/** Swedish and German search terms by structure (base) id: everyday words, Latin names, abbreviations. */
export const STRUCTURE_ALIASES: Record<string, string[]> = {
  maxilla: ['överkäke', 'överkäken', 'överkäksben', 'maxilla', 'Oberkiefer', 'Oberkieferknochen', 'Maxilla'],
  'maxillary-alveolar-process': ['alveolarutskott', 'alveolarben', 'tandfack', 'Alveolarfortsatz', 'Alveolarknochen', 'Zahnfach', 'Processus alveolaris'],
  'maxillary-dentition': ['övre tänder', 'överkäkens tänder', 'obere Zähne', 'Oberkieferzähne', 'Zahnbogen'],
  mandible: ['underkäke', 'underkäken', 'käkben', 'mandibel', 'mandibula', 'Unterkiefer', 'Unterkieferknochen', 'Mandibula'],
  'mandible-body': ['ramus', 'käkvinkel', 'corpus mandibulae', 'Ramus mandibulae', 'Unterkieferast', 'Kieferwinkel', 'Corpus mandibulae'],
  'mandibular-alveolar-process': ['alveolarutskott', 'alveolarben', 'tandfack', 'Alveolarfortsatz', 'Alveolarknochen', 'Zahnfach', 'Processus alveolaris'],
  'mandibular-condyle': ['kondyl', 'ledhuvud', 'caput mandibulae', 'Kondylus', 'Gelenkkopf', 'Caput mandibulae', 'Processus condylaris'],
  'mandibular-dentition': ['nedre tänder', 'underkäkens tänder', 'untere Zähne', 'Unterkieferzähne', 'Zahnbogen'],
  'upper-right-quadrant': ['kvadrant 1', 'Quadrant 1'],
  'upper-left-quadrant': ['kvadrant 2', 'Quadrant 2'],
  'lower-left-quadrant': ['kvadrant 3', 'Quadrant 3'],
  'lower-right-quadrant': ['kvadrant 4', 'Quadrant 4'],
  'mandibular-foramen': ['foramen mandibulae'],
  'mental-foramen': ['foramen mentale'],
  periodontium: ['parodontium', 'tandfäste', 'stödjevävnad', 'Parodont', 'Parodontium', 'Zahnhalteapparat'],
  gingiva: ['tandkött', 'gingiva', 'Zahnfleisch', 'Gingiva'],
  'gingiva-upper': ['tandkött', 'Zahnfleisch'],
  'gingiva-lower': ['tandkött', 'Zahnfleisch'],
  nerves: ['nerv', 'nerver', 'trigeminus', 'Nerv', 'Nerven', 'Trigeminus'],
  'mandibular-nerve-branches': ['n. mandibularis', 'nervus mandibularis'],
  'maxillary-nerve-branches': ['n. maxillaris', 'nervus maxillaris'],
  'inferior-alveolar-nerve': ['n. alveolaris inferior', 'mandibularkanalen', 'mandibularblockad', 'Canalis mandibulae', 'Unterkiefernerv', 'Leitungsanästhesie'],
  'mental-nerve': ['n. mentalis', 'haknerv', 'Kinnnerv'],
  'incisive-nerve': ['n. incisivus'],
  'lingual-nerve': ['n. lingualis', 'tungnerv', 'Zungennerv'],
  'infraorbital-nerve': ['n. infraorbitalis'],
  'posterior-superior-alveolar-nerve': ['n. alveolaris superior posterior', 'nervus alveolaris superior posterior'],
  'middle-superior-alveolar-nerve': ['n. alveolaris superior medius', 'nervus alveolaris superior medius'],
  'anterior-superior-alveolar-nerve': ['n. alveolaris superior anterior', 'nervus alveolaris superior anterior'],
  vessels: ['blodkärl', 'kärl', 'blodförsörjning', 'Blutgefäße', 'Gefäße', 'Blutversorgung'],
  'inferior-alveolar-artery': ['artär', 'a. alveolaris inferior', 'Arterie'],
  'inferior-alveolar-vein': ['ven', 'v. alveolaris inferior', 'Vene'],
  'trigeminal-nerve': ['trigeminusnerven', 'n. trigeminus', 'femte kranialnerven', 'Trigeminusnerv', 'N. trigeminus', 'fünfter Hirnnerv'],
  'mandibular-nerve': ['n. mandibularis', 'nervus mandibularis', 'N. mandibularis'],
  'maxillary-nerve': ['n. maxillaris', 'nervus maxillaris', 'N. maxillaris', 'Oberkiefernerv'],
  'buccal-nerve': ['n. buccalis', 'kindnerv', 'Wangennerv', 'N. buccalis'],
  'arterial-supply': ['artär', 'artärer', 'Arterie', 'Arterien'],
  'external-carotid-artery': ['yttre halsartären', 'halsartär', 'a. carotis externa', 'äußere Halsschlagader', 'Halsschlagader', 'A. carotis externa'],
  'maxillary-artery': ['a. maxillaris', 'överkäksartären', 'Oberkieferarterie', 'A. maxillaris'],
  'posterior-superior-alveolar-artery': ['a. alveolaris superior posterior', 'A. alveolaris superior posterior'],
  'descending-palatine-artery': ['a. palatina descendens', 'a. palatina major', 'gomartär', 'Gaumenarterie', 'A. palatina major'],
  'buccal-artery': ['a. buccalis', 'kindartär', 'Wangenarterie', 'A. buccalis'],
  'facial-artery': ['ansiktsartären', 'a. facialis', 'Gesichtsarterie', 'A. facialis'],
  'venous-drainage': ['ven', 'vener', 'Vene', 'Venen'],
  'pterygoid-plexus': ['plexus pterygoideus', 'venplexus', 'Venengeflecht', 'Plexus pterygoideus'],
  'maxillary-vein': ['v. maxillaris', 'V. maxillaris'],
  'retromandibular-vein': ['v. retromandibularis', 'V. retromandibularis'],
  'facial-vein': ['ansiktsvenen', 'v. facialis', 'Gesichtsvene', 'V. facialis'],
  'internal-jugular-vein': ['inre halsvenen', 'halsven', 'v. jugularis interna', 'innere Drosselvene', 'Drosselvene', 'V. jugularis interna'],
  'external-jugular-vein': ['yttre halsvenen', 'v. jugularis externa', 'äußere Drosselvene', 'V. jugularis externa'],
  tmj: ['käkled', 'käkleden', 'articulatio temporomandibularis', 'Kiefergelenk', 'Kiefergelenke'],
  'articular-disc': ['disk', 'diskus', 'käkledsdisk', 'ledskiva', 'Diskus', 'Gelenkscheibe', 'Discus articularis'],
  'articular-fossa': ['ledgrop', 'fossa mandibularis', 'Gelenkgrube'],
  skull: ['skalle', 'kranium', 'Schädel', 'Cranium'],
  'temporal-bone': ['os temporale'],
  'zygomatic-bone': ['os zygomaticum', 'kindben', 'Wangenbein'],
  'palatine-bone': ['os palatinum', 'gom', 'hårda gommen', 'Gaumen', 'harter Gaumen'],
  'parietal-bone': ['os parietale'],
  'nasal-bone': ['os nasale'],
  'lacrimal-bone': ['os lacrimale'],
  'inferior-nasal-concha': ['concha nasalis inferior'],
  'frontal-bone': ['os frontale'],
  'occipital-bone': ['os occipitale'],
  'sphenoid-bone': ['os sphenoidale'],
  'ethmoid-bone': ['os ethmoidale'],
  'hyoid-bone': ['os hyoideum'],
  muscles: ['muskler', 'tuggmuskler', 'tuggmuskulatur', 'Muskeln', 'Kaumuskeln', 'Kaumuskulatur'],
  masseter: ['tuggmuskel', 'massetermuskeln', 'm. masseter', 'großer Kaumuskel', 'Kaumuskel'],
  'masseter-superficial': ['m. masseter'],
  'masseter-deep': ['m. masseter'],
  'lateral-pterygoid': ['yttre vingmuskeln', 'm. pterygoideus lateralis', 'äußerer Flügelmuskel'],
  'lateral-pterygoid-upper': ['m. pterygoideus lateralis'],
  'lateral-pterygoid-lower': ['m. pterygoideus lateralis'],
  temporalis: ['tinningmuskeln', 'm. temporalis', 'Schläfenmuskel'],
  'medial-pterygoid': ['inre vingmuskeln', 'm. pterygoideus medialis', 'innerer Flügelmuskel'],
  buccinator: ['kindmuskel', 'm. buccinator', 'Wangenmuskel', 'Trompetermuskel'],
  mentalis: ['hakmuskel', 'm. mentalis', 'Kinnmuskel'],
  'orbicularis-oris': ['läppar', 'ringmuskeln runt munnen', 'm. orbicularis oris', 'Lippen', 'Mundringmuskel'],
};

/** Swedish and German search aliases of a structure id (paired ids use their base id). */
export function structureAliases(id: string): string[] {
  return STRUCTURE_ALIASES[id] ?? STRUCTURE_ALIASES[id.replace(/-(right|left)$/, '')] ?? [];
}
