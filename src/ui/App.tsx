import { useEffect, useRef } from 'react';
import { pushCurrentPath, startRouter } from '../app/router';
import { useT } from '../i18n';
import { actions, useApp } from '../state/store';
import { useServices } from './context';
import { DetailPanel } from './DetailPanel';
import { Dock } from './Dock';
import { IconLayers, IconReset, IconSearch, IconSection } from './icons';
import { LayersPanel } from './LayersPanel';
import { AboutDialog, Footer, LoadingCard } from './Overlays';
import { SearchPanel } from './SearchPanel';
import { Identity, TopActions } from './TopBar';
import { useKeyboard } from './useKeyboard';
import { isCompact, isCompactLandscape } from '../app/viewport';

type Sheet = 'layers' | 'detail' | 'tools';
/** The panel that a mobile sheet shows (the tools sheet is the dock). */
const sheetPanel = (sheet: Sheet | 'none') => (sheet === 'tools' ? 'dock' : sheet);

/** How far a panel reaches in from the bottom edge of the app (px), 0 when it is not laid out. */
function coveredFromBottom(selector: string): number {
  const el = document.querySelector<HTMLElement>(selector);
  const parent = el?.offsetParent as HTMLElement | null;
  return el && parent ? Math.max(0, parent.clientHeight - el.offsetTop) : 0;
}

/** How far a panel reaches in from the right edge of the app (px), 0 when it is not laid out. */
function coveredFromRight(selector: string): number {
  const el = document.querySelector<HTMLElement>(selector);
  const parent = el?.offsetParent as HTMLElement | null;
  return el && parent ? Math.max(0, parent.clientWidth - el.offsetLeft) : 0;
}

export function App() {
  const { engine, registry } = useServices();
  const stage = useRef<HTMLDivElement>(null);
  const theme = useApp((s) => s.theme);
  const selected = useApp((s) => !!s.selectedId);
  const dissect = useApp((s) => s.dissectFdi !== null);
  const sheet = useApp((s) => s.mobileSheet);
  const laidOut = useApp((s) => s.explodePhase === 2);
  const detailHidden = useApp((s) => s.collapsed.detail);
  const dockHidden = useApp((s) => s.collapsed.dock);
  const lang = useApp((s) => s.lang);
  const m = useT();

  useEffect(() => {
    engine.mount(stage.current!);
    void engine.loadAll();
    const stop = startRouter(engine, registry);
    return () => {
      stop();
      engine.dispose();
    };
  }, [engine, registry]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useKeyboard(engine);

  // keep the focused anatomy clear of the panels that cover the canvas
  useEffect(() => {
    const update = () => {
      if (isCompact()) {
        // phone: an open sheet covers the lower half of the canvas
        if (!isCompactLandscape()) {
          engine.setInsets(0, sheet !== 'none' ? window.innerHeight * 0.5 : 0);
          return;
        }
        // held sideways, sheets (and the tooth controls while dissecting) cover the right side instead
        const panel = sheet !== 'none' ? sheetPanel(sheet) : dissect && !selected ? 'dock' : null;
        engine.setInsets(panel ? coveredFromRight(`.ds-${panel}`) : 0, 0);
        return;
      }
      // the bottom toolbar covers the lower edge of the canvas; the dissection tools and the phase-2 board make it taller
      // the bottom toolbar: measured, since its height depends on what it shows
      const measured = coveredFromBottom('.ds-dock');
      const bottom = dockHidden ? 0 : measured > 0 ? measured : dissect ? 210 : laidOut ? 170 : 70;
      // the detail panel: a fixed 360 px on wide screens; measured where it is narrower (tablets)
      const right = !selected || detailHidden ? 0 : window.innerWidth > 1180 ? 360 : coveredFromRight('.ds-detail') || 360;
      engine.setInsets(right, bottom);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [engine, selected, dissect, laidOut, sheet, detailHidden, dockHidden]);

  // the toolbar's current height, for side panels that must end above it (see .ds-detail and .ds-layers in app.css)
  useEffect(() => {
    const dock = document.querySelector<HTMLElement>('.ds-dock');
    if (!dock) return;
    const root = document.documentElement;
    const sync = () => {
      const covers = coveredFromBottom('.ds-dock');
      root.style.setProperty('--ds-dock-covers', `${covers}px`);
      // the layers panel only has to make room where the toolbar actually reaches under it (narrower screens)
      const layers = document.querySelector<HTMLElement>('.ds-layers');
      const toolbar = dock.querySelector<HTMLElement>('.ds-toolbar');
      const under = !!layers && !!toolbar && toolbar.getBoundingClientRect().left < layers.getBoundingClientRect().right;
      if (under) root.style.setProperty('--ds-layers-bottom', `${covers + 12}px`);
      else root.style.removeProperty('--ds-layers-bottom');
    };
    sync();
    const obs = new ResizeObserver(sync);
    obs.observe(dock);
    window.addEventListener('resize', sync);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, []);

  return (
    <div className={`ds-app${selected ? ' has-selection' : ''}${dissect ? ' is-dissecting' : ''}`}>
      <div className="ds-stage" ref={stage} />
      <div className="ds-ui">
        <Identity />
        <TopActions />
        <LayersPanel />
        <DetailPanel />
        <Dock />
        <Footer />
        <ResetButton />
        <LoadingCard />
        <nav className="ds-mobile-bar ds-panel" aria-label={m.mobileControls}>
          <button type="button" className={sheet === 'layers' ? 'is-active' : ''} onClick={() => actions.setMobileSheet(sheet === 'layers' ? 'none' : 'layers')} aria-pressed={sheet === 'layers'}>
            <IconLayers /> <span>{m.layers}</span>
          </button>
          <button type="button" onClick={() => actions.openSearch(true)}>
            <IconSearch /> <span>{m.search}</span>
          </button>
          <button type="button" className={sheet === 'tools' ? 'is-active' : ''} onClick={() => actions.setMobileSheet(sheet === 'tools' ? 'none' : 'tools')} aria-pressed={sheet === 'tools'}>
            <IconSection /> <span>{m.tools}</span>
          </button>
        </nav>
        {sheet !== 'none' && <button type="button" className="ds-scrim" aria-label={m.closePanel} onClick={() => actions.setMobileSheet('none')} />}
      </div>
      <SearchPanel />
      <AboutDialog />
    </div>
  );
}

/** Bottom-left: back to the start view with every setting at its default. */
function ResetButton() {
  const { engine, registry } = useServices();
  const m = useT();
  const reset = () => {
    actions.resetAll();
    engine.resetToStart();
    pushCurrentPath(registry);
  };
  return (
    <button type="button" className="ds-reset-all" onClick={reset} title={m.resetAllTitle} aria-label={m.resetAllTitle}>
      <IconReset size={15} />
      <span>{m.resetAll}</span>
    </button>
  );
}
