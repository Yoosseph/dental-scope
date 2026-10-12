/**
 * Quiz mode session: the state machine and persistence for the tooth quiz.
 * The session is plain data so it can live in sessionStorage — it survives a
 * page refresh and re-entering Quiz mode, and is cleared when the browser tab
 * closes or the user restarts the quiz (see `clearSavedQuiz`). No accounts,
 * cloud storage or localStorage.
 */
import { PERMANENT_FDI } from '../anatomy/notation';

export const QUIZ_SIZE = 32;
export const QUIZ_STORAGE_KEY = 'ds.quiz.session.v1';

export interface QuizProgress {
  /** The 32 permanent teeth in FDI order of asking (a permutation). */
  order: number[];
  /** Index of the current question; QUIZ_SIZE once the quiz is finished. */
  index: number;
  /** Chosen FDI per question; null until that question is submitted. */
  answers: (number | null)[];
  /** Hint mode on/off (a per-session setting). */
  hint: boolean;
}

/** Fisher–Yates shuffle of a readonly array. */
export function shuffle<T>(items: readonly T[], rnd: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A fresh quiz: all 32 permanent teeth in a shuffled order. */
export function createQuiz(rnd: () => number = Math.random): QuizProgress {
  return {
    order: shuffle(PERMANENT_FDI, rnd),
    index: 0,
    answers: Array<number | null>(QUIZ_SIZE).fill(null),
    hint: false,
  };
}

/** Record the submitted answer for the current question (a no-op once answered). */
export function submitAnswer(p: QuizProgress, answerFdi: number): QuizProgress {
  if (p.index >= QUIZ_SIZE || p.answers[p.index] !== null) return p;
  const answers = [...p.answers];
  answers[p.index] = answerFdi;
  return { ...p, answers };
}

/** Move to the next question; only allowed once the current one is submitted. */
export function advance(p: QuizProgress): QuizProgress {
  if (p.index >= QUIZ_SIZE || p.answers[p.index] === null) return p;
  return { ...p, index: p.index + 1 };
}

export function setHint(p: QuizProgress, hint: boolean): QuizProgress {
  return { ...p, hint };
}

/** The FDI number currently being asked, or null when the quiz is finished. */
export function currentFdi(p: QuizProgress): number | null {
  return p.index < QUIZ_SIZE ? p.order[p.index] : null;
}

export function isSubmitted(p: QuizProgress): boolean {
  return p.answers[p.index] !== null;
}

export function isCorrect(p: QuizProgress): boolean {
  return isSubmitted(p) && p.answers[p.index] === p.order[p.index];
}

export function score(p: QuizProgress): number {
  return p.order.reduce<number>((n, fdi, i) => n + (p.answers[i] === fdi ? 1 : 0), 0);
}

export function answeredCount(p: QuizProgress): number {
  return p.answers.reduce<number>((n, a) => n + (a !== null ? 1 : 0), 0);
}

export function serializeQuiz(p: QuizProgress): string {
  return JSON.stringify(p);
}

/** Validate an unknown value (as stored in sessionStorage) as a quiz session. */
function asQuiz(v: unknown): QuizProgress | null {
  if (!v || typeof v !== 'object') return null;
  const d = v as Record<string, unknown>;
  const order = d.order;
  if (!Array.isArray(order) || order.length !== QUIZ_SIZE) return null;
  const fdis = order as unknown[];
  if (fdis.some((f) => typeof f !== 'number' || !PERMANENT_FDI.includes(f))) return null;
  if (new Set(fdis).size !== QUIZ_SIZE) return null;
  const index = d.index;
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > QUIZ_SIZE) return null;
  const answers = d.answers;
  if (!Array.isArray(answers) || answers.length !== QUIZ_SIZE) return null;
  const chosen = answers as unknown[];
  if (chosen.some((a) => a !== null && (typeof a !== 'number' || !PERMANENT_FDI.includes(a)))) return null;
  const hint = d.hint ?? false;
  if (typeof hint !== 'boolean') return null;
  return { order: fdis as number[], index, answers: chosen as (number | null)[], hint };
}

export function parseQuiz(raw: string | null | undefined): QuizProgress | null {
  if (!raw) return null;
  try {
    return asQuiz(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** The tab-scoped storage; undefined when sessionStorage is unavailable (tests, SSR). */
function storage(): Storage | undefined {
  return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
}

export function loadSavedQuiz(): QuizProgress | null {
  try {
    return parseQuiz(storage()?.getItem(QUIZ_STORAGE_KEY) ?? null);
  } catch {
    return null;
  }
}

export function saveQuiz(p: QuizProgress) {
  try {
    storage()?.setItem(QUIZ_STORAGE_KEY, serializeQuiz(p));
  } catch {
    /* storage unavailable */
  }
}

export function clearSavedQuiz() {
  try {
    storage()?.removeItem(QUIZ_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}