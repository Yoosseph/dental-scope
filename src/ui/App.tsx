import { useEffect, useRef } from 'react';
import { pushCurrentPath, startRouter } from '../app/router';
import { actions, useApp } from '../state/store';
import { useServices } from './context';
import { DetailPanel } from './DetailPanel';
import { Dock } from './Dock';
import { IconLayers, IconReset, IconSearch, IconSection } from './icons';
import { LayersPanel } from './LayersPanel';
import { AboutDialog, Footer, LoadingCard, StartHint } from './Overlays';
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

  useKeyboard(engine);

  // keep the focused anatomy clear of the panels that cover the canvas
  useEffect(() => {
    const update = () => {
      const mobile = window.innerWidth <= 767;
      if (mobile) engine.setInsets(0, sheet !== 'none' ? window.innerHeight * 0.5 : 0);
      // the bottom toolbar covers the lower edge of the canvas; the dissection tools and the phase-2 board make it taller
      else engine.setInsets(selected && window.innerWidth > 980 ? 360 : 0, dissect || laidOut ? 170 : 70);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [engine, selected, dissect, laidOut, sheet]);

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
        <StartHint />
        <nav className="ds-mobile-bar ds-panel" aria-label="Mobile controls">
          <button type="button" className={sheet === 'layers' ? 'is-active' : ''} onClick={() => actions.setMobileSheet(sheet === 'layers' ? 'none' : 'layers')} aria-pressed={sheet === 'layers'}>
            <IconLayers /> <span>Layers</span>
          </button>
          <button type="button" onClick={() => actions.openSearch(true)}>
            <IconSearch /> <span>Search</span>
          </button>
          <button type="button" className={sheet === 'tools' ? 'is-active' : ''} onClick={() => actions.setMobileSheet(sheet === 'tools' ? 'none' : 'tools')} aria-pressed={sheet === 'tools'}>
            <IconSection /> <span>Tools</span>
          </button>
        </nav>
        {sheet !== 'none' && <button type="button" className="ds-scrim" aria-label="Close panel" onClick={() => actions.setMobileSheet('none')} />}
      </div>
      <SearchPanel />
      <AboutDialog />
    </div>
  );
}

/** Bottom-left: back to the start view with every setting at its default. */
function ResetButton() {
  const { engine, registry } = useServices();
  const reset = () => {
    actions.resetAll();
    engine.resetCamera();
    pushCurrentPath(registry);
  };
  return (
    <button type="button" className="ds-reset-all" onClick={reset} title="Reset everything to the start" aria-label="Reset everything to the start">
      <IconReset size={15} />
      <span>Reset</span>
    </button>
  );
}
