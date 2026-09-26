import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_BY_ID } from '../anatomy/categories';
import { formatTooth, NUMBERING_LABEL } from '../anatomy/notation';
import { pathFor, pushPath } from '../app/router';
import { search } from '../search/search';
import { actions, getState, useApp } from '../state/store';
import { useServices } from './context';
import { IconClose, IconSearch } from './icons';

const SUGGESTIONS = ['first molar', 'tooth 36', '11', 'pulp', 'root canal', 'enamel', 'inferior alveolar nerve', 'TMJ disc', 'wisdom tooth', 'gingiva'];

export function SearchPanel() {
  const open = useApp((s) => s.searchOpen);
  const numbering = useApp((s) => s.numbering);
  const { registry, engine, searchIndex } = useServices();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const results = useMemo(() => (q.trim() ? search(searchIndex, registry, q, numbering, 30) : []), [q, numbering, searchIndex, registry]);

  useEffect(() => {
    if (open) {
      setActive(0);
      requestAnimationFrame(() => {
        input.current?.focus();
        input.current?.select();
      });
    }
  }, [open]);
  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const choose = async (id: string) => {
    actions.openSearch(false);
    await engine.selectFromUI(id, { focus: true });
    const s = getState();
    pushPath(pathFor(s.selectedId, s.dissectFdi, registry));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      void choose(results[active].id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      actions.openSearch(false);
    }
  };

  return (
    <div className="ds-search-layer" onPointerDown={(e) => e.target === e.currentTarget && actions.openSearch(false)}>
      <div className="ds-search ds-panel" role="dialog" aria-modal="true" aria-label="Search anatomy">
        <div className="ds-search-field">
          <IconSearch size={18} />
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Tooth, number, tissue, nerve…"
            aria-label="Search anatomy"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="ds-search-results"
            aria-activedescendant={results[active] ? `ds-sr-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="ds-icon-btn ds-icon-btn--ghost" onClick={() => actions.openSearch(false)} aria-label="Close search">
            <IconClose />
          </button>
        </div>
        {results.length > 0 ? (
          <ul id="ds-search-results" className="ds-search-results" role="listbox" ref={list}>
            {results.map((r, i) => {
              const s = registry.get(r.id)!;
              const cat = s.categories.find((c) => c !== 'permanent-teeth') ?? s.categories[0];
              const catDef = cat ? CATEGORY_BY_ID[cat] : undefined;
              const fdi = s.toothFdi;
              const context = fdi !== undefined && !s.tooth ? registry.get(`tooth-${fdi}`)?.name : registry.get(s.parent ?? '')?.name;
              return (
                <li
                  key={r.id}
                  id={`ds-sr-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={i === active}
                  className={`ds-search-result${i === active ? ' is-active' : ''}`}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => void choose(r.id)}
                >
                  <span className="ds-dot" style={{ background: catDef?.color ?? 'var(--faint)' }} aria-hidden="true" />
                  <span className="ds-sr-main">
                    <span className="ds-sr-name">{s.name}</span>
                    {context && <span className="ds-sr-context">{context}</span>}
                  </span>
                  {fdi !== undefined && <span className="ds-chip ds-chip--mono">{formatTooth(fdi, numbering)}</span>}
                  {r.hint && <span className="ds-sr-hint">{r.hint}</span>}
                </li>
              );
            })}
          </ul>
        ) : q.trim() ? (
          <p className="ds-search-empty">No matches for “{q}”.</p>
        ) : (
          <div className="ds-search-suggest">
            <p className="ds-label-sm">Try</p>
            <div className="ds-chip-row">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="ds-chip ds-chip--button" onClick={() => setQ(s)}>
                  {s}
                </button>
              ))}
            </div>
            <p className="ds-search-tip">
              Numbers follow the active system ({NUMBERING_LABEL[numbering]}). Prefix with <kbd>fdi</kbd> or <kbd>#</kbd> to be explicit.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
