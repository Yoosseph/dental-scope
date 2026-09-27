/**
 * Hierarchy browser (role="tree"): the accessible, non-canvas path to every structure.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { formatTooth } from '../anatomy/notation';
import { typeLabel } from '../i18n/anatomy';
import { nameOf, useT, type Lang } from '../i18n';
import type { Structure } from '../anatomy/types';
import { pushCurrentPath } from '../app/router';
import { actions, useApp } from '../state/store';
import { useServices } from './context';
import { IconChevron, IconEye, IconEyeOff } from './icons';

export function StructureTree() {
  const { registry } = useServices();
  const selectedId = useApp((s) => s.selectedId);
  const [open, setOpen] = useState<Set<string>>(() => new Set(['dental-anatomy', 'maxilla', 'mandible']));
  const ref = useRef<HTMLDivElement>(null);

  // expand to reveal the selection
  useEffect(() => {
    if (!selectedId) return;
    const anc = registry.ancestors(selectedId).map((a) => a.id);
    setOpen((o) => {
      if (anc.every((a) => o.has(a))) return o;
      const n = new Set(o);
      anc.forEach((a) => n.add(a));
      return n;
    });
    requestAnimationFrame(() => ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }));
  }, [selectedId, registry]);

  const toggle = (id: string) => setOpen((o) => withOpen(o, id, !o.has(id)));

  const root = registry.require(registry.rootId);
  const m = useT();
  const onKeyDown = (e: React.KeyboardEvent) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="treeitem"] > .ds-tree-row') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const id = items[i].dataset.id!;
    if (e.key === 'ArrowDown') items[Math.min(items.length - 1, i + 1)]?.focus();
    else if (e.key === 'ArrowUp') items[Math.max(0, i - 1)]?.focus();
    else if (e.key === 'ArrowRight') setOpen((o) => withOpen(o, id, true));
    else if (e.key === 'ArrowLeft') setOpen((o) => withOpen(o, id, false));
    else return;
    e.preventDefault();
  };

  return (
    <div className="ds-tree" role="tree" aria-label={m.treeAria} ref={ref} onKeyDown={onKeyDown}>
      {root.children.map((c) => (
        <TreeNode key={c} id={c} depth={0} open={open} toggle={toggle} />
      ))}
    </div>
  );
}

const TreeNode = memo(function TreeNode({ id, depth, open, toggle }: { id: string; depth: number; open: Set<string>; toggle: (id: string) => void }) {
  const { registry, engine } = useServices();
  const s = registry.require(id);
  const selected = useApp((st) => st.selectedId === id);
  const hidden = useApp((st) => !!st.hidden[id]);
  const numbering = useApp((st) => st.numbering);
  const lang = useApp((st) => st.lang);
  const m = useT();
  const children = s.children.filter((c) => registry.get(c)?.kind !== 'landmark' || depth > 1);
  const expandable = children.length > 0;
  const isOpen = open.has(id);

  const select = async () => {
    await engine.selectFromUI(id, { focus: true });
    pushCurrentPath(registry);
  };

  return (
    <div role="treeitem" aria-expanded={expandable ? isOpen : undefined} aria-selected={selected} aria-level={depth + 1}>
      <div
        className={`ds-tree-row${selected ? ' is-selected' : ''}${hidden ? ' is-hidden' : ''}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        data-id={id}
        tabIndex={0}
        onClick={select}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            void select();
          }
        }}
      >
        <button
          type="button"
          tabIndex={-1}
          className={`ds-tree-caret${isOpen ? ' is-open' : ''}`}
          style={{ visibility: expandable ? 'visible' : 'hidden' }}
          onClick={(e) => {
            e.stopPropagation();
            toggle(id);
          }}
          aria-label={isOpen ? m.collapse : m.expand}
        >
          <IconChevron size={12} />
        </button>
        <span className="ds-tree-name">{label(s, lang)}</span>
        {s.tooth && <span className="ds-chip ds-chip--mono ds-chip--sm">{formatTooth(s.tooth.fdi, numbering)}</span>}
        {s.kind !== 'landmark' && (
          <button
            type="button"
            tabIndex={-1}
            className="ds-tree-eye"
            aria-label={hidden ? m.showX(nameOf(s, lang)) : m.hideX(nameOf(s, lang))}
            onClick={(e) => {
              e.stopPropagation();
              if (hidden) actions.unhide(id);
              else actions.hide(id);
            }}
          >
            {hidden ? <IconEyeOff size={13} /> : <IconEye size={13} />}
          </button>
        )}
      </div>
      {expandable && isOpen && (
        <div role="group">
          {children.map((c) => (
            <TreeNode key={c} id={c} depth={depth + 1} open={open} toggle={toggle} />
          ))}
        </div>
      )}
    </div>
  );
});

/** Copy of the set of expanded ids with `id` opened or closed. */
function withOpen(open: Set<string>, id: string, isOpen: boolean): Set<string> {
  const next = new Set(open);
  if (isOpen) next.add(id);
  else next.delete(id);
  return next;
}

/** Tree label: teeth drop the arch/side prefix, which the quadrant row above already shows. */
function label(s: Structure, lang: Lang): string {
  if (s.tooth) return typeLabel(s.tooth.type, lang);
  return nameOf(s, lang);
}
