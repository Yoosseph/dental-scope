/**
 * The /about/ page: a plain, fast, text-first HTML page (no WebGL, no app bundle)
 * that search engines and readers can use. It explains the project and carries
 * a readable guide to every permanent tooth, the numbering systems and the
 * structures in the 3D model, with links into the explorer. Built by vite.config.ts.
 */
import teeth from '../content/en/teeth.json';
import structures from '../content/en/structures.json';
import { PERMANENT_FDI, TOOTH_TYPES, TYPE_NAME, archOf, fdiToPalmer, fdiToUniversal, toothName, typeOf } from '../anatomy/notation.ts';
import type { ToothType } from '../anatomy/types.ts';
import { AUTHOR, REPOSITORY, SITE_NAME, jsonLd } from './seo.ts';

interface Entry {
  summary?: string;
  function?: string;
  clinical?: string;
  roots?: string;
  canals?: string;
  eruption?: string;
}
const TEETH = teeth as unknown as Record<string, Entry>;
const STRUCTURES = structures as unknown as Record<string, Entry>;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Glossary groups: [heading, content keys] */
const GLOSSARY: [string, string[]][] = [
  ['Parts of a tooth', ['crown', 'root', 'cej', 'apex']],
  ['Tooth tissues', ['enamel', 'dentin', 'cementum', 'pulp', 'pulp-chamber', 'pulp-horn', 'root-canals', 'apical-foramen']],
  ['Periodontium (supporting tissues)', ['periodontium', 'gingiva', 'pdl', 'maxillary-alveolar-process', 'mandibular-alveolar-process']],
  ['Jaws and joint', ['maxilla', 'mandible', 'mandibular-condyle', 'tmj', 'articular-disc', 'mandibular-foramen', 'mental-foramen']],
  [
    'Nerves and vessels',
    [
      'inferior-alveolar-nerve',
      'mental-nerve',
      'incisive-nerve',
      'lingual-nerve',
      'infraorbital-nerve',
      'posterior-superior-alveolar-nerve',
      'middle-superior-alveolar-nerve',
      'anterior-superior-alveolar-nerve',
      'inferior-alveolar-artery',
    ],
  ],
  ['Muscles of mastication and the face', ['masseter', 'temporalis', 'medial-pterygoid', 'lateral-pterygoid', 'buccinator', 'orbicularis-oris', 'mentalis']],
];

const GLOSSARY_NAME: Record<string, string> = {
  cej: 'Cementoenamel junction (CEJ)',
  pdl: 'Periodontal ligament (PDL)',
  tmj: 'Temporomandibular joint (TMJ)',
  'maxillary-alveolar-process': 'Maxillary alveolar process',
  'mandibular-alveolar-process': 'Mandibular alveolar process',
};
const termName = (k: string) => GLOSSARY_NAME[k] ?? cap(k.replace(/-/g, ' '));

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is Dental Scope?',
    a: 'Dental Scope is a free, open-source, interactive 3D model of human dental anatomy that runs in the web browser. You can rotate the skull and jaws, select any of the 32 permanent teeth, peel away enamel and dentin to see the pulp and root canals, and look at the nerves, vessels and muscles around the teeth.',
  },
  {
    q: 'Is Dental Scope free?',
    a: 'Yes. It is free to use with no account or installation, and its source code is open under the MIT licence. The 3D anatomy is derived from BodyParts3D and shared under CC BY-SA 2.1 Japan.',
  },
  {
    q: 'Who is it for?',
    a: 'Dental students, dental hygiene and dental assisting students, teachers who want a 3D model to show in class, and anyone curious about how teeth are built and numbered.',
  },
  {
    q: 'Which tooth numbering systems does it support?',
    a: 'All three common systems. The FDI World Dental Federation system (ISO 3950) uses two digits: quadrant then position, so the lower left first molar is 36. The Universal system used in the United States numbers the teeth 1 to 32, making the same tooth #19. Palmer notation writes the quadrant and position, here LL6. Switch between them with the FDI, UNI and PAL buttons.',
  },
  {
    q: 'Can I see inside a tooth?',
    a: 'Yes. Select a tooth and open Dissect anatomy to separate it into enamel, dentin, cementum, periodontal ligament, pulp chamber and root canals, or use the Section tool to cut through the model.',
  },
  {
    q: 'Does it work on phones and tablets?',
    a: 'Yes, in any current version of Chrome, Edge, Firefox or Safari with WebGL, on desktop, tablet or phone.',
  },
  {
    q: 'Can Dental Scope be used for diagnosis?',
    a: 'No. Dental Scope is an educational reference only. Internal tooth tissues are modeled with simplified proportions and nerves are placed schematically, so it must not be used for diagnosis, treatment planning or clinical decisions.',
  },
];

function toothRow(fdi: number, base: string): string {
  return `<li><a href="${base}tooth/${fdi}/">${esc(toothName(fdi))}</a> <span class="num">FDI ${fdi} · Universal ${fdiToUniversal(fdi)} · Palmer ${fdiToPalmer(fdi)}</span></li>`;
}

function toothTypeSection(type: ToothType, base: string): string {
  const arches = (['maxillary', 'mandibular'] as const)
    .map((arch) => {
      const e = TEETH[`tooth:${type}:${arch}`];
      if (!e) return '';
      const fdis = PERMANENT_FDI.filter((f) => typeOf(f) === type && archOf(f) === arch);
      const facts = [
        e.roots && `<dt>Roots</dt><dd>${esc(e.roots)}</dd>`,
        e.canals && `<dt>Root canals</dt><dd>${esc(e.canals)}</dd>`,
        e.eruption && `<dt>Eruption</dt><dd>${esc(e.eruption)}</dd>`,
      ]
        .filter(Boolean)
        .join('');
      return `
        <article class="tooth" id="${arch}-${type}">
          <h4>${esc(cap(`${arch} ${TYPE_NAME[type]}`))} <span class="alt">(${arch === 'maxillary' ? 'upper' : 'lower'})</span></h4>
          ${e.summary ? `<p>${esc(e.summary)}</p>` : ''}
          ${e.function ? `<p><strong>Function.</strong> ${esc(e.function)}</p>` : ''}
          ${e.clinical ? `<p><strong>Notes.</strong> ${esc(e.clinical)}</p>` : ''}
          ${facts ? `<dl>${facts}</dl>` : ''}
          <p class="links">View in 3D: ${fdis.map((f) => `<a href="${base}tooth/${f}/">${esc(toothName(f))} (${f} · #${fdiToUniversal(f)})</a>`).join(', ')}</p>
        </article>`;
    })
    .join('');
  return `<section class="type"><h3>${esc(cap(TYPE_NAME[type]))}s</h3>${arches}</section>`;
}

/** Full HTML document for /about/. `head` is the page's generated head tags; `base` the site base path. */
export function aboutHtml(head: string, base: string, faviconHref: string): string {
  const quadrants = [
    { label: 'Upper right (FDI quadrant 1)', q: 1 },
    { label: 'Upper left (FDI quadrant 2)', q: 2 },
    { label: 'Lower left (FDI quadrant 3)', q: 3 },
    { label: 'Lower right (FDI quadrant 4)', q: 4 },
  ];
  const glossary = GLOSSARY.map(
    ([heading, keys]) => `
      <h3>${esc(heading)}</h3>
      <dl class="terms">${keys
        .filter((k) => STRUCTURES[k]?.summary)
        .map((k) => `<dt>${esc(termName(k))}</dt><dd>${esc(STRUCTURES[k].summary!)}${STRUCTURES[k].function ? ` ${esc(STRUCTURES[k].function!)}` : ''}</dd>`)
        .join('')}</dl>`,
  ).join('');
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#ebe7de" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#11100e" media="(prefers-color-scheme: dark)" />
    ${head}
    ${jsonLd(faqLd)}
    <link rel="icon" type="image/svg+xml" href="${faviconHref}" />
    <style>${CSS}</style>
    <script defer src="/_vercel/insights/script.js"></script>
  </head>
  <body>
    <header class="top">
      <a class="brand" href="${base}">${SITE_NAME}</a>
      <a class="cta" href="${base}">Open the 3D explorer →</a>
    </header>
    <main>
      <h1>${SITE_NAME}: free interactive 3D dental anatomy</h1>
      <p class="lede">${SITE_NAME} is a free, open-source 3D dental anatomy explorer. Rotate a full skull and both jaws, pick any of the 32 permanent teeth, and dissect a tooth layer by layer, from enamel and dentin down to the pulp and root canals. It runs in the browser with nothing to install.</p>
      <p><a class="cta" href="${base}">Open the 3D explorer →</a></p>

      <nav class="toc" aria-label="On this page">
        <a href="#features">Features</a> · <a href="#teeth">All 32 teeth</a> · <a href="#numbering">Tooth numbering</a> · <a href="#types">Tooth types</a> · <a href="#glossary">Anatomy glossary</a> · <a href="#faq">FAQ</a> · <a href="#credits">Credits</a>
      </nav>

      <section id="features">
        <h2>What you can do</h2>
        <ul>
          <li><strong>Explore the whole mouth in 3D</strong>: skull, maxilla, mandible, gums and all permanent teeth, including third molars (wisdom teeth).</li>
          <li><strong>See inside every tooth</strong>: enamel, dentin, cementum, periodontal ligament, pulp chamber, pulp horns and root canals.</li>
          <li><strong>Dissect anatomy</strong>: separate the layers step by step, or lay every structure out side by side.</li>
          <li><strong>Section view</strong>: cut through the model to see cross-sections of teeth and bone.</li>
          <li><strong>Three numbering systems</strong>: FDI (ISO 3950), Universal (ADA) and Palmer, switchable at any time.</li>
          <li><strong>Nerves, vessels and muscles</strong>: inferior alveolar, lingual and superior alveolar nerves, the temporomandibular joint and the muscles of mastication.</li>
          <li><strong>Search</strong> any structure or tooth by name or number.</li>
        </ul>
      </section>

      <section id="teeth">
        <h2>All 32 permanent teeth</h2>
        <p>Each link opens the 3D explorer with that tooth selected.</p>
        <div class="quads">${quadrants
          .map(({ label, q }) => `<div><h3>${label}</h3><ol>${PERMANENT_FDI.filter((f) => Math.floor(f / 10) === q).map((f) => toothRow(f, base)).join('')}</ol></div>`)
          .join('')}</div>
      </section>

      <section id="numbering">
        <h2>Tooth numbering systems</h2>
        <p>Dentists name teeth with a short code. ${SITE_NAME} shows all three systems in common use, so you can learn to read each one. Take the lower left first molar as an example:</p>
        <table>
          <thead><tr><th>System</th><th>How it works</th><th>Lower left first molar</th></tr></thead>
          <tbody>
            <tr><td>FDI (ISO 3950)</td><td>Two digits: the quadrant (1 upper right, 2 upper left, 3 lower left, 4 lower right), then the position from the midline (1 central incisor to 8 third molar). Used in most of the world.</td><td>36</td></tr>
            <tr><td>Universal (ADA)</td><td>Numbers 1 to 32, starting at the upper right third molar, running along the upper arch to the upper left, then back along the lower arch from the lower left third molar to the lower right. Used mainly in the United States.</td><td>#19</td></tr>
            <tr><td>Palmer</td><td>A quadrant symbol with the position number 1 to 8, written here in text form as UR, UL, LL or LR plus the position. Common in the United Kingdom and in orthodontics.</td><td>LL6</td></tr>
          </tbody>
        </table>
      </section>

      <section id="types">
        <h2>Tooth types</h2>
        <p>The permanent dentition has eight teeth in each quadrant: two incisors, one canine, two premolars and three molars. Typical textbook values are shown; individual anatomy varies.</p>
        ${TOOTH_TYPES.map((t) => toothTypeSection(t, base)).join('')}
      </section>

      <section id="glossary">
        <h2>Dental anatomy glossary</h2>
        <p>The structures you can select in the 3D model, in short.</p>
        ${glossary}
      </section>

      <section id="faq">
        <h2>Frequently asked questions</h2>
        ${FAQ.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}
      </section>

      <section id="credits">
        <h2>Credits and licence</h2>
        <p>Made by ${AUTHOR}. The source code is on <a href="${REPOSITORY}" rel="noopener">GitHub</a>. The jaws, teeth, gums, skull and muscles come from <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" rel="noopener">BodyParts3D</a>, © The Database Center for Life Science, licensed under <a href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en" rel="noopener">CC Attribution-Share Alike 2.1 Japan</a>. Third molars, alveolar bone and the joint are derived from those meshes; enamel, dentin, cementum, periodontal ligament, pulp and canals are modeled with simplified proportions; nerves and vessels are schematic.</p>
        <p class="note">${SITE_NAME} is an educational reference. It is not intended for diagnosis, treatment planning or clinical decisions.</p>
      </section>
    </main>
    <footer class="bottom"><a href="${base}">${SITE_NAME}</a> · Free 3D dental anatomy · Made by <a href="${REPOSITORY}" rel="noopener">${AUTHOR}</a></footer>
  </body>
</html>
`;
}

const CSS = `
:root{--bg:#ebe7de;--ink:#1c1a17;--muted:#6b665d;--line:#d6d0c4;--card:#f6f3ed;--accent:#9a3b3b}
@media (prefers-color-scheme:dark){:root{--bg:#11100e;--ink:#ece8e1;--muted:#a39d92;--line:#2c2a26;--card:#1a1916;--accent:#e08a7e}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent)}
.top{display:flex;justify-content:space-between;align-items:center;gap:16px;max-width:880px;margin:0 auto;padding:20px 16px}
.brand{font:600 22px/1.2 Georgia,"Times New Roman",serif;color:var(--ink);text-decoration:none}
.cta{display:inline-block;padding:8px 14px;border-radius:999px;background:var(--ink);color:var(--bg);text-decoration:none;font-weight:600;font-size:14px;white-space:nowrap}
main{max-width:880px;margin:0 auto;padding:8px 16px 48px}
h1{font:600 clamp(30px,5vw,44px)/1.15 Georgia,"Times New Roman",serif;margin:24px 0 16px}
h2{font:600 26px/1.25 Georgia,"Times New Roman",serif;margin:48px 0 12px;padding-top:16px;border-top:1px solid var(--line)}
h3{font-size:18px;margin:28px 0 8px}
h4{font-size:16px;margin:0 0 6px}
.lede{font-size:18px}
.toc{margin:24px 0;color:var(--muted);font-size:14px}
.quads{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px 24px}
.quads ol{padding-left:20px;margin:0}
.num,.alt{color:var(--muted);font-size:13px;font-weight:400}
.tooth{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:12px 0}
.tooth p{margin:6px 0}
.tooth dl{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:8px 0;font-size:14px}
.tooth dt{color:var(--muted)}
.tooth dd{margin:0}
.links{font-size:14px}
.terms dt{font-weight:600;margin-top:10px}
.terms dd{margin:2px 0 0}
table{width:100%;border-collapse:collapse;font-size:15px;display:block;overflow-x:auto}
th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--line)}
.note{color:var(--muted);font-size:14px}
.bottom{max-width:880px;margin:0 auto;padding:24px 16px 40px;color:var(--muted);font-size:14px;border-top:1px solid var(--line)}
`;
