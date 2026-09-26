import { useMemo } from 'react';
import { CATEGORIES, PRESETS, type CategoryState } from '../anatomy/categories';
import type { CategoryId } from '../anatomy/types';
import { actions, useApp } from '../state/store';
import { useServices } from './context';
import { IconCheck, IconGhost, IconLayers, IconReset, IconTree } from './icons';
import { StructureTree } from './StructureTree';

export function LayersPanel() {
  const panel = useApp((s) => s.panel);
  const mobileOpen = useApp((s) => s.mobileSheet === 'layers');
  return (
    <aside className={`ds-panel ds-layers${mobileOpen ? ' is-mobile-open' : ''}`} aria-label="Layers and structures">
      <div className="ds-tabs" role="tablist" aria-label="Panel">
        <button type="button" role="tab" aria-selected={panel === 'layers'} className={panel === 'layers' ? 'is-active' : ''} onClick={() => actions.setPanel('layers')}>
          <IconLayers size={14} /> Layers
        </button>
        <button type="button" role="tab" aria-selected={panel === 'tree'} className={panel === 'tree' ? 'is-active' : ''} onClick={() => actions.setPanel('tree')}>
          <IconTree size={14} /> Structures
        </button>
      </div>
      {panel === 'layers' ? <Categories /> : <StructureTree />}
    </aside>
  );
}

function Categories() {
  const { registry } = useServices();
  const cats = useApp((s) => s.categories);
  const hiddenCount = useApp((s) => Object.keys(s.hidden).length + Object.keys(s.ghosted).length);
  const isolate = useApp((s) => s.isolateId);
  const counts = useMemo(() => registry.countByCategory(), [registry]);
  const presetActive = PRESETS.find((p) => CATEGORIES.every((c) => (p.state[c.id] ?? 'off') === cats[c.id]))?.id;
  const groups = useMemo(() => {
    const m = new Map<string, typeof CATEGORIES>();
    for (const c of CATEGORIES) m.set(c.group, [...(m.get(c.group) ?? []), c]);
    return [...m.entries()];
  }, []);
  const visibilityNote = [hiddenCount ? `${hiddenCount} adjusted` : '', isolate ? 'Isolated' : ''].filter(Boolean).join(' · ');

  return (
    <>
      <div className="ds-segmented ds-segmented--fill" role="radiogroup" aria-label="Layer presets">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={presetActive === p.id} className={presetActive === p.id ? 'is-active' : ''} onClick={() => actions.setCategories(p.state)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="ds-layer-list" role="list">
        {groups.map(([group, list]) => (
          <div key={group} className="ds-layer-group" role="group" aria-label={group}>
            <div className="ds-layer-group-title">{group}</div>
            {list.map((c) => (
              <CategoryRow key={c.id} id={c.id} label={c.label} color={c.color} planned={!!c.planned} count={counts[c.id] ?? 0} state={cats[c.id]} />
            ))}
          </div>
        ))}
      </div>
      <div className="ds-panel-footer">
        <span>{visibilityNote}</span>
        <button type="button" className="ds-link-btn" onClick={() => actions.resetVisibility()}>
          <IconReset size={13} /> Reset
        </button>
      </div>
    </>
  );
}

function CategoryRow({ id, label, color, count, state, planned }: { id: CategoryId; label: string; color: string; count: number; state: CategoryState; planned: boolean }) {
  if (planned) {
    return (
      <div className="ds-layer-row is-planned" role="listitem" title="Not modeled yet">
        <span className="ds-dot-toggle is-static" style={{ '--dot': color } as React.CSSProperties} aria-hidden="true">
          <span className="ds-dot-toggle-dot" />
        </span>
        <span className="ds-layer-name">{label}</span>
        <span className="ds-soon">planned</span>
      </div>
    );
  }
  const on = state !== 'off';
  return (
    <div className={`ds-layer-row${on ? '' : ' is-off'}`} role="listitem">
      {/* the layer's own colour is the visibility toggle: filled with a check when shown, outlined when hidden */}
      <button
        type="button"
        className={`ds-dot-toggle${on ? ' is-on' : ''}${state === 'ghost' ? ' is-ghost' : ''}`}
        style={{ '--dot': color, '--dot-ink': inkOn(color) } as React.CSSProperties}
        onClick={() => actions.setCategory(id, on ? 'off' : 'on')}
        aria-pressed={on}
        aria-label={`Show ${label}`}
        title={on ? `Hide ${label}` : `Show ${label}`}
      >
        <span className="ds-dot-toggle-dot" aria-hidden="true">
          <IconCheck size={11} strokeWidth={2.6} />
        </span>
      </button>
      <button type="button" className="ds-layer-name" onClick={() => actions.showOnlyCategory(id)} title={`Show only ${label}`} aria-label={`Show only ${label}`}>
        {label}
      </button>
      <span className="ds-count">{count}</span>
      <button
        type="button"
        className={`ds-ghost-btn${state === 'ghost' ? ' is-active' : ''}`}
        onClick={() => actions.setCategory(id, state === 'ghost' ? 'on' : 'ghost')}
        aria-pressed={state === 'ghost'}
        aria-label={`Make ${label} translucent`}
        title="Translucent"
      >
        <IconGhost size={14} />
      </button>
    </div>
  );
}

/** Check-mark colour that stays legible on a layer colour: ink on light swatches, white on dark ones. */
function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? '#17150f' : '#ffffff';
}
