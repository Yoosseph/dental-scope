/**
 * Quiz mode UI: a tooth-identification quiz on the separated board of 32
 * permanent teeth. The session lives in sessionStorage (`src/modes/quiz.ts`),
 * so it resumes across a refresh or after leaving and re-entering the mode.
 *
 * The board itself is driven by the store (`explodePhase: 2`) and by the
 * Quiz mode visibility filter registered in `src/modes/modes.ts`, which shows
 * only the tooth shells. Nothing here shows a tooth's name, FDI number or
 * detail until the current question is submitted.
 */
import { useEffect, useState } from 'react';
import { typeOf } from '../anatomy/notation';
import { nameOf, useLang, useT } from '../i18n';
import { QUIZ_HINTS } from '../i18n/quiz';
import { EXPLORE_MODE, QUIZ_MODE, switchMode } from '../modes/modes';
import {
  advance,
  answeredCount,
  clearSavedQuiz,
  createQuiz,
  currentFdi,
  isCorrect,
  isSubmitted,
  loadSavedQuiz,
  saveQuiz,
  score,
  setHint,
  submitAnswer,
  type QuizProgress,
  QUIZ_SIZE,
} from '../modes/quiz';
import { actions, useApp } from '../state/store';
import { useServices } from './context';
import { IconCheck, IconChevron, IconClose, IconReset, IconTooth } from './icons';

export function QuizMode() {
  const m = useT();
  const lang = useLang();
  const { engine, registry } = useServices();
  const selectedId = useApp((s) => s.selectedId);
  const [session, setSession] = useState<QuizProgress>(() => loadSavedQuiz() ?? createQuiz());
  const [folded, setFolded] = useState(false);

  // keep the saved session in step with every change (also survives a refresh)
  useEffect(() => {
    saveQuiz(session);
  }, [session]);

  const leave = () => switchMode(QUIZ_MODE, EXPLORE_MODE, { registry, engine });

  const fdi = currentFdi(session);
  const finished = fdi === null;
  const tooth = fdi !== null ? registry.get(`tooth-${fdi}`) : undefined;
  const name = tooth !== undefined ? nameOf(tooth, lang) : '';
  const submitted = fdi !== null && isSubmitted(session);
  const correct = submitted && isCorrect(session);
  const answerFdi = !submitted && selectedId !== null ? registry.get(selectedId)?.toothFdi ?? null : null;
  const hint = !submitted && session.hint && fdi !== null ? QUIZ_HINTS[lang][typeOf(fdi)] : null;

  const onPick = () => {
    if (fdi === null || submitted || answerFdi === null) return;
    setSession((s) => submitAnswer(s, answerFdi));
    // reveal: highlight the correct tooth on the board
    actions.select(`tooth-${fdi}`);
  };
  const onNext = () => {
    if (fdi === null) return;
    actions.select(null);
    setSession((s) => advance(s));
  };
  const onRestart = () => {
    clearSavedQuiz();
    actions.select(null);
    setSession(() => createQuiz());
  };

  return (
    <section className={`ds-panel ds-quiz${folded ? ' is-folded' : ''}`} aria-label={m.quizTitle}>
      <header className="ds-quiz-head">
        <h2 className="ds-quiz-title">
          <IconTooth size={17} />
          {m.quizTitle}
        </h2>
        <span className="ds-quiz-meta">
          <span className="ds-quiz-progress">{m.quizProgress(Math.min(session.index + 1, QUIZ_SIZE), QUIZ_SIZE)}</span>
          <span className="ds-quiz-score">{m.quizScore(score(session), answeredCount(session))}</span>
        </span>
        <button
          type="button"
          className="ds-quiz-restart"
          aria-label={m.quizRestart}
          title={m.quizRestart}
          onClick={onRestart}
        >
          <IconReset size={15} />
        </button>
        <button
          type="button"
          className="ds-quiz-fold"
          aria-expanded={!folded}
          aria-label={folded ? m.quizFoldOpen : m.quizFoldClose}
          onClick={() => setFolded((v) => !v)}
        >
          <IconChevron size={16} />
        </button>
        <button type="button" className="ds-quiz-exit" aria-label={m.quizExit} onClick={leave}>
          {m.quizExit}
        </button>
      </header>

      <div className="ds-quiz-body">
        {finished ? (
          <div className="ds-quiz-done">
            <h3>{m.quizComplete}</h3>
            <p>{m.quizCompleteBody(score(session), QUIZ_SIZE)}</p>
            <div className="ds-quiz-actions">
              <button type="button" className="ds-primary" onClick={onRestart}>
                <IconReset size={15} />
                {m.quizRestart}
              </button>
              <button type="button" className="ds-secondary" onClick={leave}>{m.quizExit}</button>
            </div>
          </div>
        ) : (
          <>
            <p className="ds-quiz-q">
              <span className="sr-only">{m.quizQuestion}: </span>
              <span>{m.quizFind}</span>
              <strong>{name}</strong>
            </p>

            <p className="ds-quiz-guide" role="status" aria-live="polite" data-state={submitted ? (correct ? 'ok' : 'ko') : answerFdi !== null ? 'picked' : 'idle'}>
              {submitted ? (
                correct ? (
                  <><IconCheck size={15} /> {m.quizCorrect}</>
                ) : (
                  <><IconClose size={15} /> {m.quizIncorrect}</>
                )
              ) : answerFdi !== null ? (
                m.quizSelected
              ) : (
                m.quizPickInstruction
              )}
            </p>

            {submitted && fdi !== null && tooth !== undefined && (
              <p className="ds-quiz-answer" data-state={correct ? 'ok' : 'ko'}>
                {m.quizAnswerWas(name, fdi)}
              </p>
            )}

            <div className="ds-quiz-hint">
              <button
                type="button"
                className="ds-hint-toggle"
                aria-pressed={session.hint}
                onClick={() => setSession((s) => setHint(s, !s.hint))}
              >
                <span>{m.quizHint}</span>
                <span className="ds-hint-state">{session.hint ? m.quizHintOn : m.quizHintOff}</span>
              </button>
              {hint !== null && (
                <p className="ds-hint-text">
                  <span>{hint}</span>
                  <em>{m.quizDraft}</em>
                </p>
              )}
            </div>

            <div className="ds-quiz-actions">
              {submitted ? (
                <button type="button" className="ds-primary" onClick={onNext}>
                  {session.index + 1 >= QUIZ_SIZE ? m.quizFinish : m.quizNext}
                  <IconChevron size={14} />
                </button>
              ) : (
                <button type="button" className="ds-primary" disabled={answerFdi === null} onClick={onPick}>
                  {m.quizSubmit}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}