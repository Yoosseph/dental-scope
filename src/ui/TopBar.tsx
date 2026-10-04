import { NUMBERING_LABEL, NUMBERING_SHORT, NUMBERING_SYSTEMS } from '../anatomy/notation';
import { REPO_URL } from '../app/repo';
import { useT } from '../i18n';
import { actions, useApp } from '../state/store';
import { IconExternal, IconInfo, IconMoon, IconSearch, IconSun } from './icons';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Identity() {
  const m = useT();
  return (
    <header className="ds-identity">
      <h1 className="ds-title">Dental Scope</h1>
      <p className="ds-credit">
        {REPO_URL ? (
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label={m.madeByAria}>
            {m.madeBy}
            <IconExternal size={11} />
          </a>
        ) : (
          m.madeBy
        )}
      </p>
    </header>
  );
}

export function TopActions() {
  const theme = useApp((s) => s.theme);
  const m = useT();
  return (
    <div className="ds-top-actions">
      <LanguageSwitcher />
      <NumberingControls />
      <button type="button" className="ds-search-trigger" onClick={() => actions.openSearch(true)} aria-label={m.searchAnatomy} aria-keyshortcuts="/">
        <IconSearch />
        <span>{m.searchAnatomy}</span>
        <kbd>/</kbd>
      </button>
      <button type="button" className="ds-icon-btn" onClick={() => actions.setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? m.toLight : m.toDark} title={m.theme}>
        {theme === 'dark' ? <IconSun /> : <IconMoon />}
      </button>
      <button type="button" className="ds-icon-btn" onClick={() => actions.openAbout(true)} aria-label={m.aboutAria} title={m.about}>
        <IconInfo />
      </button>
    </div>
  );
}

export function NumberingControls() {
  const numbering = useApp((s) => s.numbering);
  const m = useT();
  return (
    <div className="ds-numbering ds-segmented ds-segmented--mono" role="radiogroup" aria-label={m.numberingGroup}>
      {NUMBERING_SYSTEMS.map((s) => (
        <button key={s} type="button" role="radio" aria-checked={numbering === s} className={numbering === s ? 'is-active' : ''} onClick={() => actions.setNumbering(s)} title={m.numberingTitle(NUMBERING_LABEL[s])}>
          {NUMBERING_SHORT[s]}
        </button>
      ))}
    </div>
  );
}
