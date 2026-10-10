import { useEffect, useRef } from 'react';
import { navigate, startRouter } from '../app/router';
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
import { useViewportInsets } from './useViewportInsets';
import { GuidedTour } from './GuidedTour';
import { CreditsDialog } from './CreditsDialog';

export function App() {
  const { engine, registry } = useServices();
  const stage = useRef<HTMLDivElement>(null);
  const theme = useApp((s) => s.theme);
  const selected = useApp((s) => !!s.selectedId);
  const dissect = useApp((s) => s.dissectFdi !== null);
  const sheet = useApp((s) => s.mobileSheet);
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

  useViewportInsets(engine);

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
          <button type="button" data-tour="search" onClick={() => actions.openSearch(true)}>
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
      <CreditsDialog />
      <GuidedTour />
    </div>
  );
}

/** Bottom-left: back to the start view with every setting at its default. */
function ResetButton() {
  const { engine } = useServices();
  const m = useT();
  const guideOpen = useApp(s => s.guideOpen);
  const reset = () => {
    void navigate(() => { actions.resetAll(); engine.resetToStart(); });
  };
  return (
    <button type="button" className={`ds-reset-all${guideOpen ? ' is-guide-reset' : ''}`} onClick={reset} title={m.resetAllTitle} aria-label={m.resetAllTitle}>
      <IconReset size={15} />
      <span>{m.resetAll}</span>
    </button>
  );
}
