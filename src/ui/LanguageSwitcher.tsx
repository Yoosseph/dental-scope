/**
 * Flag buttons for the interface language. English is the default; the choice is
 * remembered per browser. Flags are inline SVG (Windows does not draw flag emoji).
 */
import { LANGS, LANG_NATIVE, MESSAGES, useLang, useT, type Lang } from '../i18n';
import { actions } from '../state/store';

export function LanguageSwitcher() {
  const lang = useLang();
  const m = useT();
  return (
    <div className="ds-lang" role="radiogroup" aria-label={m.langLabel}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          lang={l}
          aria-checked={lang === l}
          className={lang === l ? 'is-active' : ''}
          onClick={() => actions.setLang(l)}
          aria-label={LANG_NATIVE[l]}
          title={lang === l ? LANG_NATIVE[l] : MESSAGES[l].switchTo}
        >
          <Flag lang={l} />
        </button>
      ))}
    </div>
  );
}

function Flag({ lang }: { lang: Lang }) {
  const common = { width: 22, height: 15, preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': true, focusable: false } as const;
  if (lang === 'sv')
    return (
      <svg {...common} viewBox="0 0 16 10">
        <rect width="16" height="10" fill="#006aa7" />
        <rect x="5" width="2" height="10" fill="#fecc00" />
        <rect y="4" width="16" height="2" fill="#fecc00" />
      </svg>
    );
  if (lang === 'de')
    return (
      <svg {...common} viewBox="0 0 5 3">
        <rect width="5" height="1" y="0" fill="#000" />
        <rect width="5" height="1" y="1" fill="#dd0000" />
        <rect width="5" height="1" y="2" fill="#ffce00" />
      </svg>
    );
  // United Kingdom
  return (
    <svg {...common} viewBox="0 0 60 30">
      <clipPath id="ds-flag-uk-a">
        <path d="M0 0v30h60V0z" />
      </clipPath>
      <clipPath id="ds-flag-uk-b">
        <path d="M30 15h30v15zv15H0zH0V0zV0h30z" />
      </clipPath>
      <g clipPath="url(#ds-flag-uk-a)">
        <path d="M0 0v30h60V0z" fill="#012169" />
        <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" />
        <path d="M0 0l60 30m0-30L0 30" clipPath="url(#ds-flag-uk-b)" stroke="#c8102e" strokeWidth="4" />
        <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
        <path d="M30 0v30M0 15h60" stroke="#c8102e" strokeWidth="6" />
      </g>
    </svg>
  );
}
