import { useEffect, useRef } from 'react';
import { startRouter } from '../app/router';
import { actions, useApp } from '../state/store';
import { useServices } from './context';
import { DetailPanel } from './DetailPanel';
import { Dock } from './Dock';
import { IconLayers, IconSearch, IconSection } from './icons';
import { LayersPanel } from './LayersPanel';
import { AboutDialog, Footer, LoadingCard } from './Overlays';
import { SearchPanel } from './SearchPanel';
import { Identity, TopActions } from './TopBar';
import { useKeyboard } from './useKeyboard';
import { ViewRail } from './ViewRail';

export function App() {
  const { engine, registry } = useServices();
  const stage = useRef<HTMLDivElement>(null);
  const theme = useApp((s) => s.theme);
  const selected = useApp((s) => !!s.selectedId);
  const dissect = useApp((s) => s.dissectFdi !== null);
  const sheet = useApp((s) => s.mobileSheet);

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

  return (
    <div className={`ds-app${selected ? ' has-selection' : ''}${dissect ? ' is-dissecting' : ''}`}>
      <div className="ds-stage" ref={stage} />
      <div className="ds-ui">
        <Identity />
        <TopActions />
        <LayersPanel />
        <ViewRail />
        <DetailPanel />
        <Dock />
        <Footer />
        <LoadingCard />
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
