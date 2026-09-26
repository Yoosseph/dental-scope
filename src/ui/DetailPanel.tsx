import { useMemo } from 'react';
import { CATEGORY_BY_ID } from '../anatomy/categories';
import { formatTooth, NUMBERING_SHORT, NUMBERING_SYSTEMS } from '../anatomy/notation';
import type { NumberingSystem, Structure } from '../anatomy/types';
import { pushCurrentPath } from '../app/router';
import { resolveContent } from '../content/content';
import { actions, useApp } from '../state/store';
import { useServices } from './context';
import { IconArrowLeft, IconClose, IconEyeOff, IconFocus, IconGhost, IconIsolate, IconTooth } from './icons';

const NUMBERING_TITLE: Record<NumberingSystem, string> = { fdi: 'FDI (ISO 3950)', universal: 'Universal (ADA)', palmer: 'Palmer' };

export function DetailPanel() {
  const { registry, engine } = useServices();
  const selectedId = useApp((s) => s.selectedId);
  const numbering = useApp((s) => s.numbering);
  const isolateId = useApp((s) => s.isolateId);
  const dissectFdi = useApp((s) => s.dissectFdi);
  const ghosted = useApp((s) => (selectedId ? !!s.ghosted[selectedId] : false));
  const mobileOpen = useApp((s) => s.mobileSheet === 'detail');
  const s = selectedId ? registry.get(selectedId) : undefined;
  const content = useMemo(() => (s ? resolveContent(registry, s.id) : null), [registry, s]);
  if (!s || !content) return null;

  const cat = s.categories.find((c) => c !== 'permanent-teeth') ?? s.categories[0] ?? registry.ancestors(s.id).find((a) => a.categories.length)?.categories[0];
  const catDef = cat ? CATEGORY_BY_ID[cat] : undefined;
  const fdi = s.toothFdi;
  const tooth = fdi !== undefined ? registry.get(`tooth-${fdi}`) : undefined;
  const crumbs = registry.ancestors(s.id).reverse().filter((a) => a.id !== registry.rootId);
  const isolated = isolateId === s.id;
  const children = s.children.map((c) => registry.get(c)!).filter(Boolean);

  const go = async (id: string) => {
    await engine.selectFromUI(id, { focus: true });
    pushCurrentPath(registry);
  };

  return (
    <aside className={`ds-panel ds-detail${mobileOpen ? ' is-mobile-open' : ''}`} aria-label={`${s.name} details`} aria-live="polite">
      <div className="ds-detail-head">
        <span className="ds-detail-bar" style={{ background: catDef?.color ?? 'var(--accent)' }} aria-hidden="true" />
        <div className="ds-eyebrow">{catDef?.label ?? kindLabel(s)}</div>
        <button type="button" className="ds-icon-btn ds-icon-btn--ghost ds-detail-close" onClick={() => actions.select(null)} aria-label="Close details">
          <IconClose />
        </button>
        <h2 className="ds-detail-title">{s.name}</h2>
        {tooth?.tooth && fdi !== undefined && (
          <div className="ds-notation" aria-label="Tooth notation">
            {NUMBERING_SYSTEMS.map((n) => (
              <span key={n} className={`ds-chip ds-chip--mono${numbering === n ? ' is-active' : ''}`} title={NUMBERING_TITLE[n]}>
                <em>{NUMBERING_SHORT[n]}</em> {formatTooth(fdi, n).replace('#', '')}
              </span>
            ))}
          </div>
        )}
        {crumbs.length > 0 && (
          <nav className="ds-crumbs" aria-label="Location in hierarchy">
            {crumbs.map((c, i) => (
              <span key={c.id}>
                {i > 0 && <span aria-hidden="true"> › </span>}
                <button type="button" className="ds-link-btn" onClick={() => void go(c.id)}>
                  {c.tooth ? `${formatTooth(c.tooth.fdi, numbering)} ${shortTooth(c)}` : c.name}
                </button>
              </span>
            ))}
          </nav>
        )}
      </div>

      <div className="ds-detail-body">
        {content.summary ? <p className="ds-detail-summary">{content.summary}</p> : <p className="ds-detail-summary is-muted">No description yet.</p>}
        {content.function && <Section title="Function">{content.function}</Section>}
        {content.clinical && <Section title="Clinical relevance">{content.clinical}</Section>}

        {(content.facts.length > 0 || tooth?.tooth) && (
          <dl className="ds-facts">
            {s.tooth && (
              <>
                <dt>Arch · side</dt>
                <dd>
                  {cap(s.tooth.arch)} · {s.tooth.side}
                </dd>
              </>
            )}
            {content.facts.map((f) => (
              <Fact key={f.label} label={f.label} value={f.value} />
            ))}
            {s.tooth && s.tooth.roots.length > 0 && (
              <Fact label="Modeled here" value={modeledSummary(s.tooth.roots)} />
            )}
            {s.sourceRef && <Fact label="Atlas reference" value={s.sourceRef} />}
          </dl>
        )}

        {children.length > 0 && (
          <div className="ds-detail-block">
            <div className="ds-label-sm">Contains</div>
            <div className="ds-chip-row">
              {children.slice(0, 18).map((c) => (
                <button key={c.id} type="button" className="ds-chip ds-chip--button" onClick={() => void go(c.id)}>
                  {c.tooth ? `${formatTooth(c.tooth.fdi, numbering)} · ${shortTooth(c)}` : c.name}
                </button>
              ))}
              {children.length > 18 && <span className="ds-chip">+{children.length - 18}</span>}
            </div>
          </div>
        )}
        {content.related.length > 0 && (
          <div className="ds-detail-block">
            <div className="ds-label-sm">Related</div>
            <div className="ds-chip-row">
              {content.related.map((id) => (
                <button key={id} type="button" className="ds-chip ds-chip--button" onClick={() => void go(id)}>
                  {registry.get(id)?.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="ds-detail-actions">
        {s.tooth && dissectFdi === s.tooth.fdi ? (
          <button type="button" className="ds-primary" onClick={leaveTooth}>
            <IconArrowLeft /> Back to the full mouth
          </button>
        ) : s.tooth ? (
          <button type="button" className="ds-primary" onClick={() => void enterDissect(s.tooth!.fdi)}>
            <IconTooth /> Explore inside this tooth
          </button>
        ) : (
          <button type="button" className="ds-primary" onClick={() => (isolated ? actions.isolate(null) : isolate(s.id))}>
            <IconIsolate /> {isolated ? 'Show surrounding anatomy' : 'Isolate structure'}
          </button>
        )}
        <div className="ds-action-row">
          <button type="button" className="ds-secondary" onClick={() => engine.focus(s.id)} title="Focus (F)">
            <IconFocus size={15} /> Focus
          </button>
          {s.kind !== 'landmark' && (
            <>
              <button type="button" className={`ds-secondary${ghosted ? ' is-active' : ''}`} onClick={() => actions.toggleGhost(s.id)} aria-pressed={ghosted} title="Translucent (G)">
                <IconGhost size={15} /> Ghost
              </button>
              <button type="button" className="ds-secondary" onClick={() => actions.hide(s.id)} title="Hide (H)">
                <IconEyeOff size={15} /> Hide
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );

  function isolate(id: string) {
    actions.isolate(id);
    requestAnimationFrame(() => engine.focus(id));
  }

  function leaveTooth() {
    const f = dissectFdi!;
    actions.exitDissect();
    engine.focus(`tooth-${f}`);
    pushCurrentPath(registry);
  }

  async function enterDissect(f: number) {
    actions.enterDissect(f);
    await engine.ensureTooth(f);
    engine.focus(`tooth-${f}`);
    pushCurrentPath(registry);
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ds-detail-section">
      <h3>{title}</h3>
      <p>{children}</p>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
/** "2 roots · 3 canals" */
function modeledSummary(roots: { canals: string[] }[]): string {
  return `${plural(roots.length, 'root')} · ${plural(roots.reduce((a, r) => a + r.canals.length, 0), 'canal')}`;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const shortTooth = (s: Structure) => s.name.replace(/^(Maxillary|Mandibular) (right|left) /, '');
function kindLabel(s: Structure) {
  return s.kind === 'landmark' ? 'Landmark' : s.kind === 'region' ? 'Region' : 'Structure';
}
