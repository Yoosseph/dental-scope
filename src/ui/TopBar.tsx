import { NUMBERING_LABEL } from '../anatomy/notation';
import type { NumberingSystem } from '../anatomy/types';
import { actions, useApp } from '../state/store';
import { IconInfo, IconMoon, IconSearch, IconSun } from './icons';

const SYSTEMS: NumberingSystem[] = ['fdi', 'universal', 'palmer'];

export function Identity() {
  return (
    <header className="ds-identity">
      <h1 className="ds-title">Dental Scope</h1>
      <p className="ds-subtitle">Dental anatomy in 3D</p>
    </header>
  );
}

export function TopActions() {
  const numbering = useApp((s) => s.numbering);
  const theme = useApp((s) => s.theme);
  return (
    <div className="ds-top-actions">
      <div className="ds-segmented ds-segmented--mono" role="radiogroup" aria-label="Tooth numbering system">
        {SYSTEMS.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={numbering === s} className={numbering === s ? 'is-active' : ''} onClick={() => actions.setNumbering(s)} title={`${NUMBERING_LABEL[s]} tooth numbering`}>
            {s === 'fdi' ? 'FDI' : s === 'universal' ? 'UNI' : 'PAL'}
          </button>
        ))}
      </div>
      <button type="button" className="ds-search-trigger" onClick={() => actions.openSearch(true)} aria-label="Search anatomy" aria-keyshortcuts="/">
        <IconSearch />
        <span>Search anatomy</span>
        <kbd>/</kbd>
      </button>
      <button type="button" className="ds-icon-btn" onClick={() => actions.setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title="Theme">
        {theme === 'dark' ? <IconSun /> : <IconMoon />}
      </button>
      <button type="button" className="ds-icon-btn" onClick={() => actions.openAbout(true)} aria-label="About Dental Scope" title="About">
        <IconInfo />
      </button>
    </div>
  );
}
