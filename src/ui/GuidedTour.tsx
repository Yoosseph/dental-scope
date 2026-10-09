import { useEffect, useRef, useState } from 'react';
import { FIRST_VISIT_TOOTH, FIRST_VISIT_TOUR, needsFirstVisitGuide, playTour, rememberGuideVisit, tourDelay } from '../app/tour';
import { isCompactLayout } from '../app/viewport';
import { DEVELOPMENT_SOURCES } from '../content/developmentAnatomy';
import { useLang } from '../i18n';
import { DEVELOPMENT_TEXT } from '../i18n/development';
import { TOUR_TEXT } from '../i18n/tour';
import { actions, getState, useApp } from '../state/store';
import { useServices } from './context';
import { IconClose, IconPlay, IconPause, IconReplay } from './icons';

type Mark = { target: string; rect: DOMRect; clicking: boolean };
const targetElement = (target: string) => [...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)].find(element => element.checkVisibility() && element.getBoundingClientRect().width > 0) ?? null;
const visible = (element: HTMLElement | null) => {
  if (!element || !element.checkVisibility()) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
};

/** One overlay renders any script; all demonstrated clicks use the existing UI handlers. */
export function GuidedTour() {
  const { engine } = useServices();
  const open = useApp(s => s.guideOpen);
  const runId = useApp(s => s.guideRunId);
  const ready = useApp(s => s.ready);
  const error = useApp(s => s.error);
  const creditsOpen = useApp(s => s.creditsOpen);
  const lang = useLang();
  const text = TOUR_TEXT[lang];
  const [index, setIndex] = useState(0);
  const [mark, setMark] = useState<Mark | null>(null);
  const [highlight, setHighlight] = useState(false);
  const [status, setStatus] = useState<'loading' | 'playing' | 'ready' | 'error'>('loading');
  const [paused, setPaused] = useState(false);
  const pauseRef = useRef(false);
  const hiddenRef = useRef(document.hidden);
  const controller = useRef<AbortController | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const circle = useRef<SVGSVGElement>(null);
  const autoChecked = useRef(false);
  const step = FIRST_VISIT_TOUR[index];
  const caption = text.steps[step.id];

  useEffect(() => {
    if (!ready || error || autoChecked.current) return;
    autoChecked.current = true;
    // A shared credits link should open quietly, without starting a tour behind it.
    if (creditsOpen) return;
    // Access to localStorage itself may throw (privacy modes / blocked storage).
    let firstVisit = true;
    try { firstVisit = needsFirstVisitGuide(localStorage); } catch { /* Show once this session. */ }
    if (firstVisit) actions.startGuide();
  }, [ready, error, creditsOpen]);

  const cleanScene = () => { actions.resetGuideScene(); engine.resetToStart(); };
  const close = () => {
    controller.current?.abort();
    cleanScene();
    actions.closeGuide();
  };

  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    controller.current = abort;
    const signal = abort.signal;
    const focusBefore = document.activeElement;
    pauseRef.current = false;
    setPaused(false);
    setIndex(0);
    setMark(null);
    setHighlight(false);
    setStatus('loading');
    actions.resetGuideScene(true);
    engine.resetToStart();
    try { rememberGuideVisit(localStorage); } catch { /* Storage is optional. */ }
    card.current?.querySelector<HTMLButtonElement>('button')?.focus();

    const demonstrate = async () => {
      // Preload before any asynchronous selection. Closing during loading cannot select a tooth later.
      // The abortable race also lets the overlay unmount promptly on a slow connection.
      await Promise.race([engine.ensureTooth(FIRST_VISIT_TOOTH), tourDelay(30000, signal).then(() => { throw new Error('Tooth loading timed out'); })]);
      signal.throwIfAborted();
      if (!ready) {
        while (!getState().ready && !getState().error) await tourDelay(100, signal);
      }
      if (getState().error) throw new Error('Scene loading failed');
      setStatus('playing');
      await playTour(FIRST_VISIT_TOUR, {
        paused: () => pauseRef.current || hiddenRef.current,
        showStep: (_step, next) => setIndex(next),
        prepare: next => {
          if (next.panel) {
            actions.setCollapsed(next.panel === 'tools' ? 'dock' : next.panel, false);
            if (isCompactLayout()) actions.setMobileSheet(next.panel);
          }
        },
        locate: target => {
          const element = targetElement(target);
          if (!element) return false;
          element!.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
          const rect = element!.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= window.innerHeight;
        },
        point: (target, clicking) => {
          const element = targetElement(target)!;
          setMark({ target, rect: element.getBoundingClientRect(), clicking });
          setHighlight(true);
        },
        activate: next => {
          signal.throwIfAborted();
          if (next.action === 'finish') {
            actions.resetGuideScene(true);
            engine.resetToStart();
            setStatus('ready');
          } else if (next.action === 'search') actions.setSearchQuery(next.value ?? '');
          else if (next.target) {
            const element = targetElement(next.target)!;
            const control = element.matches('button, [role="option"]') ? element : element.querySelector<HTMLElement>('button');
            if (!control) throw new Error('Tour control unavailable');
            control.click();
          }
        },
        settled: next => {
          const s = getState();
          if (s.error) throw new Error('Scene loading failed');
          const expected = next.waitFor;
          return (!expected?.selectedId || s.selectedId === expected.selectedId)
            && (expected?.dissectFdi === undefined || s.dissectFdi === expected.dissectFdi)
            && (!expected?.asset || s.loading[expected.asset] === 1);
        },
        clearPointer: () => setHighlight(false),
      }, signal, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };
    void demonstrate().catch(() => {
      if (signal.aborted) return;
      setMark(null);
      setStatus('error');
      actions.resetGuideScene(true);
      engine.resetToStart();
    });

    const onVisibility = () => { hiddenRef.current = document.hidden; };
    const onFocus = (event: FocusEvent) => {
      if (!card.current?.contains(event.target as Node)) card.current?.querySelector<HTMLButtonElement>('button')?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        abort.abort();
        actions.resetGuideScene();
        engine.resetToStart();
        actions.closeGuide();
      } else if (event.key === 'Tab') {
        const buttons = [...card.current!.querySelectorAll<HTMLElement>('button:not(:disabled), summary, details[open] a[href]')];
        const current = buttons.indexOf(document.activeElement as HTMLElement);
        event.preventDefault();
        buttons[(current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('focusin', onFocus);
    window.addEventListener('keydown', onKey, true);
    return () => {
      abort.abort();
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('focusin', onFocus);
      window.removeEventListener('keydown', onKey, true);
      if (focusBefore instanceof HTMLElement && focusBefore.isConnected) focusBefore.focus();
      else document.querySelector<HTMLButtonElement>('[data-tour="replay"]')?.focus();
    };
  }, [open, runId, engine]);

  // Follow responsive tray motion imperatively; React does not render per animation frame.
  useEffect(() => {
    if (!mark) return;
    let frame = 0;
    const track = () => {
      const element = targetElement(mark.target);
      if (element && visible(element)) {
        const rect = element.getBoundingClientRect();
        if (cursor.current) { cursor.current.style.left = `${rect.x + rect.width / 2}px`; cursor.current.style.top = `${rect.y + rect.height / 2}px`; }
        if (circle.current) {
          circle.current.style.left = `${rect.x - 10}px`; circle.current.style.top = `${rect.y - 8}px`;
          circle.current.style.width = `${rect.width + 20}px`; circle.current.style.height = `${rect.height + 16}px`;
        }
        const position = isCompactLayout()
          ? rect.bottom < window.innerHeight / 2 ? 'bottom' : 'top'
          : rect.left > window.innerWidth * .65 && rect.top > 80 ? 'left' : 'top';
        if (card.current && card.current.dataset.position !== position) card.current.dataset.position = position;
      }
      frame = requestAnimationFrame(track);
    };
    frame = requestAnimationFrame(track);
    return () => cancelAnimationFrame(frame);
  }, [mark]);

  if (!open) return null;
  const togglePause = () => { pauseRef.current = !pauseRef.current; setPaused(pauseRef.current); };
  const development = step.development && DEVELOPMENT_TEXT[lang];
  return <div className={`ds-tour${paused ? ' is-paused' : ''}`}>
    <div className="ds-tour-shield" aria-hidden="true" />
    {mark && status === 'playing' && <>
      {highlight &&
      <svg ref={circle} key={mark.target} className="ds-tour-circle" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"
        style={{ left: mark.rect.x - 10, top: mark.rect.y - 8, width: mark.rect.width + 20, height: mark.rect.height + 16 }}>
        <path d="M 48,5 C 16,0 2,18 4,49 C 2,82 25,98 55,95 C 86,96 99,77 96,45 C 95,17 76,3 44,7" pathLength="1" />
      </svg>}
      <div ref={cursor} className={`ds-tour-cursor${mark.clicking ? ' is-clicking' : ''}`} aria-hidden="true"
        style={{ left: mark.rect.x + mark.rect.width / 2, top: mark.rect.y + mark.rect.height / 2 }}>
        <span className="ds-tour-click" />
        <svg width="34" height="42" viewBox="0 0 34 42"><path d="M3 2 L3 31 L11 24 L17 38 L24 35 L18 21 L29 21 Z" fill="var(--accent)" stroke="var(--panel-solid)" strokeWidth="3" strokeLinejoin="round" /></svg>
      </div>
    </>}
    <div ref={card} className="ds-tour-card ds-panel" role="dialog" aria-modal="true" aria-labelledby="ds-tour-title" aria-describedby="ds-tour-body" data-position="top">
      <div className="ds-tour-heading">
        <span className="ds-label-sm">{text.label}</span>
        <button type="button" className="ds-icon-btn ds-icon-btn--ghost" onClick={close} aria-label={text.close}><IconClose size={17} /></button>
      </div>
      <div className="ds-tour-copy" aria-live="polite" aria-atomic="true">
        <h2 id="ds-tour-title">{caption[0]}</h2>
        <p id="ds-tour-body">{status === 'loading' ? text.loading : status === 'error' ? text.error : development && step.development ? development.stages[step.development].summary : caption[1]}</p>
        {status === 'playing' && development && step.development && <>
          <p className="ds-tour-evidence">{text.example} {development.draft}</p>
          <details className="ds-tour-evidence"><summary>{development.sources}</summary><p>{development.note}</p>
            {DEVELOPMENT_SOURCES.map((source, i) => <span key={source.url}>{i > 0 && ' · '}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></span>)}</details>
        </>}
      </div>
      <div className="ds-tour-progress" aria-hidden="true"><span style={{ width: `${(index + 1) / FIRST_VISIT_TOUR.length * 100}%` }} /></div>
      <div className="ds-tour-actions">
        <span className="ds-tour-count">{index + 1} / {FIRST_VISIT_TOUR.length}</span>
        {status === 'ready' ? <button type="button" className="ds-primary" onClick={close}>{text.explore}</button> : <>
          <button type="button" className="ds-secondary ds-tour-skip" onClick={close}>{text.skip}</button>
          {status === 'error' ? <button type="button" className="ds-secondary" onClick={actions.startGuide}><IconReplay size={14} />{text.retry}</button> :
            <button type="button" className="ds-secondary" onClick={togglePause}>{paused ? <IconPlay size={14} /> : <IconPause size={14} />}{paused ? text.resume : text.pause}</button>}
        </>}
      </div>
    </div>
  </div>;
}
