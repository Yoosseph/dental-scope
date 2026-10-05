import { useEffect, useRef } from 'react';
import { pushCurrentPath, startRouter } from '../app/router';
import { useT } from '../i18n';
import { actions, useApp } from '../state/store';
import { useServices } from './context';
import { DetailPanel } from './DetailPanel';
import { Dock } from './Dock';
import { IconInfo, IconLayers, IconReset, IconSearch, IconSection } from './icons';
import { LayersPanel } from './LayersPanel';
import { AboutDialog, Footer, LoadingCard } from './Overlays';
import { SearchPanel } from './SearchPanel';
import { Identity, TopActions } from './TopBar';
import { useKeyboard } from './useKeyboard';
import { COMPACT_LAYOUT } from '../app/viewport';

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
  const layersHidden = useApp((s) => s.collapsed.layers);
  const jawControls = useApp((s) => s.jawControls);
  const developmentStage = useApp((s) => s.developmentStage);
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
    const ui = document.querySelector<HTMLElement>('.ds-ui');
    const compact = window.matchMedia(COMPACT_LAYOUT);
    let frame = 0;
    const visibleRect = (selector: string) => {
      const element = ui?.querySelector<HTMLElement>(selector);
      if (!element || (!compact.matches && element.classList.contains('is-collapsed'))) return null;
      const rect = element.getBoundingClientRect();
      return rect.width && rect.height ? rect : null;
    };
    const update = () => {
      frame = 0;
      if (!ui) return;
      const bounds = ui.getBoundingClientRect();
      document.documentElement.style.setProperty('--visual-height', `${window.visualViewport?.height ?? bounds.height}px`);
      document.documentElement.style.setProperty('--visual-top', `${window.visualViewport?.offsetTop ?? 0}px`);
      const toolbar = visibleRect('.ds-dock');
      const bar = visibleRect('.ds-mobile-bar');
      const panel = compact.matches ? visibleRect('.ds-layers.is-mobile-open, .ds-detail.is-mobile-open') : visibleRect('.ds-detail');
      const sideSheet = compact.matches && window.matchMedia('(orientation: landscape) and (max-height: 600px)').matches;
      const bottoms = [toolbar, bar, ...(!sideSheet && compact.matches ? [panel] : [])].filter((r): r is DOMRect => !!r);
      const bottom = Math.max(0, ...bottoms.map((r) => bounds.bottom - r.top + 12));
      const side = sideSheet ? panel ?? (sheet === 'tools' ? toolbar : null) : !compact.matches ? panel : null;
      const right = side ? bounds.right - side.left + 12 : 0;
      const layers = !compact.matches && dissect ? visibleRect('.ds-layers') : null;
      const left = layers ? layers.right - bounds.left + 12 : 0;
      // Landscape tool sheets occupy the side, not the lower half of the model.
      const clearance = sideSheet && sheet === 'tools' ? (bar ? bounds.bottom - bar.top + 12 : 0) : bottom;
      ui.style.setProperty('--dock-clearance', `${Math.max(64, bottom + 12)}px`);
      engine.setInsets(Math.min(right, bounds.width - 100), Math.min(clearance, bounds.height - 100), Math.min(left, bounds.width - 100));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    const observer = new ResizeObserver(schedule);
    if (ui) observer.observe(ui);
    for (const element of ui?.querySelectorAll('.ds-dock, .ds-layers, .ds-detail, .ds-mobile-bar') ?? []) observer.observe(element);
    compact.addEventListener('change', schedule);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      compact.removeEventListener('change', schedule);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [engine, selected, dissect, laidOut, sheet, detailHidden, dockHidden, layersHidden, jawControls, developmentStage, lang]);

  return (
    <div className={`ds-app${selected ? ' has-selection' : ''}${dissect ? ' is-dissecting' : ''}`} data-sheet={sheet}>
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
          {selected && <button type="button" className={sheet === 'detail' ? 'is-active' : ''} onClick={() => actions.setMobileSheet(sheet === 'detail' ? 'none' : 'detail')} aria-pressed={sheet === 'detail'}>
            <IconInfo /> <span>{m.details}</span>
          </button>}
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
