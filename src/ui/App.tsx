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
      const mobile = window.innerWidth <= 767;
      if (mobile) engine.setInsets(0, sheet !== 'none' ? window.innerHeight * 0.5 : 0);
      // the bottom toolbar covers the lower edge of the canvas; the dissection tools and the phase-2 board make it taller
      else {
        // the bottom toolbar: measured, since its height depends on what it shows
        const dock = document.querySelector<HTMLElement>('.ds-dock');
        const parent = dock?.offsetParent as HTMLElement | null;
        const measured = dock && parent ? parent.clientHeight - dock.offsetTop : 0;
        const bottom = dockHidden ? 0 : measured > 0 ? measured : dissect ? 210 : laidOut ? 170 : 70;
        engine.setInsets(selected && !detailHidden && window.innerWidth > 980 ? 360 : 0, bottom);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [engine, selected, dissect, laidOut, sheet, detailHidden, dockHidden]);

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
