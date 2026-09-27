import { Fragment, useEffect, useRef } from 'react';
import { REPO_URL } from '../app/repo';
import { useT } from '../i18n';
import { actions, useApp } from '../state/store';
import { IconClose } from './icons';

/** Loading stages, in order (their names are in the messages, `stage`). */
const STAGES = ['core', 'context', 'neurovascular'];

export function LoadingCard() {
  const ready = useApp((s) => s.ready);
  const loading = useApp((s) => s.loading);
  const error = useApp((s) => s.error);
  const m = useT();
  if (error) {
    return (
      <div className="ds-loading ds-panel" role="alert">
        <strong>{m.somethingWrong}</strong>
        <p>{error === 'load' ? m.loadError : error}</p>
      </div>
    );
  }
  const pending = STAGES.filter((s) => (loading[s] ?? 0) < 1);
  if (ready && pending.length === 0) return null;
  const done = STAGES.reduce((a, s) => a + (loading[s] ?? 0), 0) / STAGES.length;
  return (
    <div className={`ds-loading ds-panel${ready ? ' is-compact' : ''}`} role="status" aria-live="polite">
      <div className="ds-loading-head">
        <span className="ds-spinner" aria-hidden="true" />
        <span>{ready ? m.loadingStage(m.stage[pending[0]] ?? '') : m.preparing}</span>
      </div>
      {!ready && (
        <>
          <div className="ds-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${Math.max(0.04, done)})` }} />
          </div>
          <ul className="ds-loading-stages">
            {STAGES.map((s) => (
              <li key={s} className={(loading[s] ?? 0) >= 1 ? 'is-done' : ''}>
                {m.stage[s]}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** `text` with the first `word` set in italics. */
function withEm(text: string, word: string) {
  const i = text.indexOf(word);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <em>{word}</em>
      {text.slice(i + word.length)}
    </>
  );
}

/** The static about page for the active language (English at about/, translations at about/sv/ and about/de/). */
export function aboutPageHref(lang: string): string {
  return `${import.meta.env.BASE_URL}about/${lang === 'en' ? '' : `${lang}/`}`;
}

export function Footer() {
  const m = useT();
  const lang = useApp((s) => s.lang);
  return (
    <footer className="ds-footer">
      <p className="ds-disclaimer">
        {m.disclaimer}{' '}
        <button type="button" className="ds-link-btn" onClick={() => actions.openAbout(true)}>
          {m.controlsCredits}
        </button>
        {' · '}
        <a className="ds-link-btn" href={aboutPageHref(lang)}>
          {m.about}
        </a>
      </p>
    </footer>
  );
}

export function AboutDialog() {
  const open = useApp((s) => s.aboutOpen);
  const lang = useApp((s) => s.lang);
  const m = useT();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="ds-about ds-panel" onClose={() => actions.openAbout(false)} aria-labelledby="ds-about-title">
      <button type="button" className="ds-icon-btn ds-icon-btn--ghost ds-about-close" onClick={() => actions.openAbout(false)} aria-label={m.close}>
        <IconClose />
      </button>
      <h2 id="ds-about-title">{m.aboutTitle}</h2>
      <p>{m.aboutIntro}</p>
      <p>
        <a href={aboutPageHref(lang)}>{m.aboutGuide}</a>
      </p>
      <h3>{m.eduTitle}</h3>
      <p>{m.eduBody}</p>
      <h3>{m.madeTitle}</h3>
      <ul>
        <li>
          <strong>{m.provSource}</strong> — {withEm(m.provSourceBody, 'BodyParts3D')}
        </li>
        <li>
          <strong>{m.provDerived}</strong> — {m.provDerivedBody}
        </li>
        <li>
          <strong>{m.provModeled}</strong> — {m.provModeledBody}
        </li>
        <li>
          <strong>{m.provAtlas}</strong> — {withEm(m.provAtlasBody, 'Z-Anatomy')}
        </li>
        <li>
          <strong>{m.provSchematic}</strong> — {m.provSchematicBody}
        </li>
      </ul>
      {REPO_URL && (
        <p>
          <a href={`${REPO_URL}/blob/main/docs/sources.md`} target="_blank" rel="noopener noreferrer" aria-label={m.sourcesAria}>
            {m.sources}
          </a>
          .
        </p>
      )}
      <h3>{m.controlsTitle}</h3>
      <dl className="ds-keys">
        {m.keys.map(([k, v]) => (
          <Fragment key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </Fragment>
        ))}
      </dl>
      <p className="ds-about-foot">
        {m.licences}
        {REPO_URL && (
          <>
            {' · '}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              {m.sourceOnGithub}
            </a>
          </>
        )}
      </p>
    </dialog>
  );
}
