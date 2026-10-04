/**
 * Deep links (docs/architecture.md §4):
 *   /tooth/36            select & focus tooth 36 (FDI)
 *   /tooth/36/dissect    open the dissection of tooth 36
 *   /structure/<id>      select & focus any structure
 */
import type { Registry } from '../anatomy/registry';
import type { Structure } from '../anatomy/types';
import type { Engine } from '../engine/Engine';
import { actions, getState, store } from '../state/store';
import { documentTitle } from './seo';
import type { Lang } from '../i18n';

/** Tool name stays the same in every interface language. */
export function localTitle(sel: (Pick<Structure, 'name' | 'tooth'> & { names?: Partial<Record<Lang, string>> }) | undefined, _lang: Lang): string {
  return documentTitle(sel);
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
/**
 * With a relative base (e.g. `DS_BASE=./` for static hosting in an unknown
 * sub-folder) path URLs would break relative asset loading, so routes live in
 * the hash instead: `#/tooth/36`.
 */
const HASH = import.meta.env.BASE_URL.startsWith('.');

function currentPath(): string {
  return HASH ? location.hash.replace(/^#/, '') || '/' : location.pathname;
}

/** `VITE_DS_URL=off` disables URL updates (for embedding in hosts that own the URL). */
const WRITE_URL = import.meta.env.VITE_DS_URL !== 'off';

function writeUrl(path: string, push: boolean) {
  if (!WRITE_URL) return;
  const url = HASH ? `#${path.replace(/^\.?/, '')}` : path + location.search;
  if (push) history.pushState(null, '', url);
  else history.replaceState(null, '', url);
}

export interface Route {
  id: string | null;
  dissect: boolean;
}

export function parsePath(path: string, registry: Registry): Route {
  const p = !HASH && path.startsWith(BASE) ? path.slice(BASE.length) : path;
  let m = /^\/tooth\/(\d{2})(\/dissect)?\/?$/.exec(p);
  if (m && registry.get(`tooth-${m[1]}`)) return { id: `tooth-${m[1]}`, dissect: !!m[2] };
  m = /^\/structure\/([a-z0-9-]+)\/?$/.exec(p);
  if (m && registry.get(m[1])) return { id: m[1], dissect: false };
  return { id: null, dissect: false };
}

export function pathFor(id: string | null, dissectFdi: number | null, registry: Registry): string {
  const base = HASH ? '' : BASE;
  if (!id && dissectFdi === null) return `${base}/`;
  if (!id && dissectFdi !== null) return `${base}/tooth/${dissectFdi}/dissect`;
  const s = registry.get(id!);
  // trailing slash matches the static tooth pages (tooth/36/index.html) and their canonical URLs
  if (s?.tooth) return `${base}/tooth/${s.tooth.fdi}${dissectFdi === s.tooth.fdi ? '/dissect' : '/'}`;
  return `${base}/structure/${id}`;
}

export function startRouter(engine: Engine, registry: Registry): () => void {
  let applying = false;

  const apply = async (path: string) => {
    const r = parsePath(path, registry);
    applying = true;
    try {
      if (!r.id) {
        if (getState().dissectFdi !== null) actions.exitDissect();
        actions.select(null);
        return;
      }
      const s = registry.get(r.id)!;
      if (r.dissect && s.tooth) {
        actions.enterDissect(s.tooth.fdi);
        await engine.ensureTooth(s.tooth.fdi);
      }
      await engine.selectFromUI(r.id, { focus: true });
    } finally {
      applying = false;
    }
  };

  const syncTitle = (id: string | null) => {
    document.title = localTitle(id ? registry.get(id) : undefined, getState().lang);
  };
  syncTitle(getState().selectedId);
  const unsub = store.subscribe((s, p) => {
    if (s.selectedId !== p.selectedId || s.lang !== p.lang) syncTitle(s.selectedId);
    if (applying) return;
    if (s.selectedId === p.selectedId && s.dissectFdi === p.dissectFdi) return;
    const next = pathFor(s.selectedId, s.dissectFdi, registry);
    if (next !== currentPath()) writeUrl(next, false);
  });
  const onPop = () => void apply(currentPath());
  window.addEventListener('popstate', onPop);
  if (HASH) window.addEventListener('hashchange', onPop);
  void apply(currentPath());
  return () => {
    unsub();
    window.removeEventListener('popstate', onPop);
    window.removeEventListener('hashchange', onPop);
  };
}

/** Explicit navigation (search, tree): pushes a history entry. */
export function pushPath(path: string) {
  if (path !== currentPath()) writeUrl(path, true);
}

/** Push a history entry for the current selection / dissection. */
export function pushCurrentPath(registry: Registry) {
  const { selectedId, dissectFdi } = getState();
  pushPath(pathFor(selectedId, dissectFdi, registry));
}
