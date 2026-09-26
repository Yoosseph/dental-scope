import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Registry } from './anatomy/registry';
import { loadManifest } from './engine/assets';
import { Engine } from './engine/Engine';
import { buildIndex } from './search/search';
import { restorePreferences } from './state/store';
import { App } from './ui/App';
import { ServicesContext } from './ui/context';
import '@fontsource/inter-tight/400.css';
import '@fontsource/inter-tight/500.css';
import '@fontsource/inter-tight/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource-variable/source-serif-4/opsz.css';
import './styles/tokens.css';
import './styles/app.css';

async function boot() {
  restorePreferences();
  const root = createRoot(document.getElementById('root')!);
  if (!hasWebGL()) {
    root.render(<p className="ds-fatal">Dental Scope needs WebGL. Please use a current version of Chrome, Edge, Firefox or Safari.</p>);
    return;
  }
  const manifest = await loadManifest();
  const registry = new Registry(manifest);
  const engine = new Engine(registry);
  const searchIndex = buildIndex(registry);
  if (import.meta.env.DEV) Object.assign(window, { ds: { registry, engine } });
  root.render(
    <StrictMode>
      <ServicesContext.Provider value={{ registry, engine, searchIndex }}>
        <App />
      </ServicesContext.Provider>
    </StrictMode>,
  );
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

boot().catch((e) => {
  console.error(e);
  document.getElementById('root')!.innerHTML = '<p class="ds-fatal">Dental Scope could not start. Please reload the page.</p>';
});
