import { NUMBERING_LABEL, NUMBERING_SHORT, NUMBERING_SYSTEMS } from '../anatomy/notation';
import { REPO_URL } from '../app/repo';
import { actions, useApp } from '../state/store';
import { IconExternal, IconInfo, IconMoon, IconSearch, IconSun } from './icons';

export function Identity() {
  return (
    <header className="ds-identity">
      <h1 className="ds-title">Dental Scope</h1>
      <p className="ds-subtitle">Dental anatomy in 3D</p>
      <p className="ds-credit">
        {REPO_URL ? (
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="Made by Yoseph – Dental Scope on GitHub (opens in a new tab)">
            Made by Yoseph
            <IconExternal size={11} />
          </a>
        ) : (
          'Made by Yoseph'
        )}
      </p>
    </header>
  );
}

export function TopActions() {
  const numbering = useApp((s) => s.numbering);
  const theme = useApp((s) => s.theme);
  return (
    <div className="ds-top-actions">
      <div className="ds-segmented ds-segmented--mono" role="radiogroup" aria-label="Tooth numbering system">
        {NUMBERING_SYSTEMS.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={numbering === s} className={numbering === s ? 'is-active' : ''} onClick={() => actions.setNumbering(s)} title={`${NUMBERING_LABEL[s]} tooth numbering`}>
            {NUMBERING_SHORT[s]}
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
