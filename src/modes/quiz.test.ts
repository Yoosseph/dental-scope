import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PERMANENT_FDI } from '../anatomy/notation';
import {
  advance,
  answeredCount,
  clearSavedQuiz,
  createQuiz,
  currentFdi,
  isCorrect,
  isRevealed,
  isSubmitted,
  loadSavedQuiz,
  parseQuiz,
  revealAnswer,
  saveQuiz,
  score,
  serializeQuiz,
  setHint,
  setShuffle,
  shuffle,
  submitAnswer,
  QUIZ_SIZE,
  QUIZ_STORAGE_KEY,
  type QuizProgress,
} from './quiz';

/** Deterministic pseudo-random source so shuffles are repeatable in tests. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const finished: QuizProgress = {
  order: [...PERMANENT_FDI],
  board: [
    ...PERMANENT_FDI.filter((f) => f < 30),
    ...PERMANENT_FDI.filter((f) => f >= 30),
  ],
  index: QUIZ_SIZE,
  answers: PERMANENT_FDI.map((f) => f),
  revealed: Array<boolean>(QUIZ_SIZE).fill(false),
  hint: false,
  shuffle: true,
};

describe('shuffle', () => {
  it('keeps every element exactly once', () => {
    const out = shuffle(PERMANENT_FDI, seeded(7));
    expect([...out].sort((a, b) => a - b)).toEqual([...PERMANENT_FDI].sort((a, b) => a - b));
  });

  it('is deterministic for a fixed random source', () => {
    expect(shuffle([1, 2, 3, 4, 5], seeded(3))).toEqual(shuffle([1, 2, 3, 4, 5], seeded(3)));
  });

  it('does not mutate its input', () => {
    const input = [1, 2, 3];
    shuffle(input, seeded(1));
    expect(input).toEqual([1, 2, 3]);
  });
});

describe('session flow', () => {
  it('creates a quiz over all 32 permanent teeth in a shuffled order', () => {
    const q = createQuiz(seeded(11));
    expect(q.order).toHaveLength(QUIZ_SIZE);
    expect(new Set(q.order).size).toBe(QUIZ_SIZE);
    expect(q.order.every((f) => PERMANENT_FDI.includes(f))).toBe(true);
    expect(q.index).toBe(0);
    expect(q.answers.every((a) => a === null)).toBe(true);
    expect(q.hint).toBe(false);
    expect(currentFdi(q)).toBe(q.order[0]);
  });

  it('records one submitted answer per question and scores it', () => {
    const q = createQuiz(seeded(5));
    const target = q.order[0];
    expect(isSubmitted(q)).toBe(false);

    const wrong = submitAnswer(q, target === 11 ? 12 : 11);
    expect(isSubmitted(wrong)).toBe(true);
    expect(isCorrect(wrong)).toBe(false);
    expect(answeredCount(wrong)).toBe(1);
    expect(score(wrong)).toBe(0);

    const right = submitAnswer(q, target);
    expect(isCorrect(right)).toBe(true);
    expect(score(right)).toBe(1);
  });

  it('ignores answers after the question is submitted and after the quiz ends', () => {
    const q = submitAnswer(createQuiz(seeded(2)), PERMANENT_FDI[0]);
    expect(submitAnswer(q, PERMANENT_FDI[1]).answers[0]).toBe(q.answers[0]);
    expect(submitAnswer(finished, PERMANENT_FDI[0])).toBe(finished);
  });

  it('advances only after submitting and stops at the end', () => {
    const q = createQuiz(seeded(9));
    expect(advance(q)).toBe(q); // nothing submitted yet
    const answered = submitAnswer(q, q.order[0]);
    const next = advance(answered);
    expect(next.index).toBe(1);
    expect(next.answers[0]).toBe(answered.answers[0]);

    const last = { ...answered, index: QUIZ_SIZE - 1 };
    const done = advance(submitAnswer(last, last.order[QUIZ_SIZE - 1]));
    expect(done.index).toBe(QUIZ_SIZE);
    expect(currentFdi(done)).toBe(null);
    expect(advance(done)).toBe(done);
  });

  it('finishes with a score and answer count across the whole quiz', () => {
    // every answer correct except the first
    const answers = PERMANENT_FDI.map((f, i) => (i === 0 ? (f === 11 ? 12 : 11) : f));
    const q: QuizProgress = { ...finished, answers, hint: true };
    expect(score(q)).toBe(QUIZ_SIZE - 1);
    expect(answeredCount(q)).toBe(QUIZ_SIZE);
  });

  it('toggles the hint setting without touching answers', () => {
    const q = createQuiz(seeded(3));
    const on = setHint(q, true);
    expect(on.hint).toBe(true);
    expect(on.answers).toEqual(q.answers);
    expect(setHint(on, false).hint).toBe(false);
  });
});

describe('board shuffle', () => {
  it('creates a board with both arches in their own half', () => {
    const q = createQuiz(seeded(13));
    expect(q.board).toHaveLength(QUIZ_SIZE);
    expect(new Set(q.board).size).toBe(QUIZ_SIZE);
    expect(q.board.slice(0, 16).every((f) => f < 30)).toBe(true);
    expect(q.board.slice(16).every((f) => f >= 30)).toBe(true);
    expect(q.shuffle).toBe(true);
  });

  it('permutes each arch independently when it draws a new board', () => {
    const boards = new Set<string>();
    for (let seed = 0; seed < 12; seed++) boards.add(createQuiz(seeded(seed)).board.join(','));
    expect(boards.size).toBeGreaterThan(1);
  });

  it('draws a fresh board whenever the setting changes', () => {
    const q = createQuiz(seeded(21));
    const off = setShuffle(q, false, seeded(22));
    expect(off.shuffle).toBe(false);
    expect(off.board).toHaveLength(QUIZ_SIZE);
    expect(new Set(off.board).size).toBe(QUIZ_SIZE);
    expect(off.order).toEqual(q.order);
    const on = setShuffle(off, true, seeded(23));
    expect(on.shuffle).toBe(true);
    expect(new Set(on.board).size).toBe(QUIZ_SIZE);
  });
});

describe('reveal answer', () => {
  it('reveals the current question and counts it as answered but not correct', () => {
    const q = createQuiz(seeded(31));
    const revealed = revealAnswer(q);
    expect(isRevealed(revealed)).toBe(true);
    expect(isSubmitted(revealed)).toBe(true);
    expect(isCorrect(revealed)).toBe(false);
    expect(answeredCount(revealed)).toBe(1);
    expect(score(revealed)).toBe(0);
  });

  it('never overrides a submitted answer', () => {
    const q = createQuiz(seeded(32));
    const answered = submitAnswer(q, q.order[0]);
    const revealed = revealAnswer(answered);
    expect(revealed).toBe(answered);
    expect(isRevealed(revealed)).toBe(false);
  });

  it('advances after a reveal and has no effect once the quiz is finished', () => {
    const q = revealAnswer(createQuiz(seeded(33)));
    expect(advance(q).index).toBe(1);
    expect(revealAnswer(finished)).toBe(finished);
    expect(isSubmitted(finished)).toBe(false);
  });
});

describe('serialization', () => {
  it('round-trips a session through JSON', () => {
    const q = submitAnswer(createQuiz(seeded(42)), PERMANENT_FDI[3]);
    const parsed = parseQuiz(serializeQuiz(q));
    expect(parsed).toEqual(q);
  });

  it('accepts a finished session', () => {
    expect(parseQuiz(serializeQuiz(finished))).toEqual(finished);
  });

  it('rejects malformed or tampered sessions', () => {
    const valid = serializeQuiz(createQuiz(seeded(1)));
    expect(parseQuiz(valid)).not.toBeNull();
    expect(parseQuiz(null)).toBeNull();
    expect(parseQuiz(undefined)).toBeNull();
    expect(parseQuiz('')).toBeNull();
    expect(parseQuiz('not json')).toBeNull();
    expect(parseQuiz('{"order":[]}')).toBeNull();
    // duplicate order entries
    const dup = JSON.parse(valid) as QuizProgress;
    dup.order[1] = dup.order[0];
    expect(parseQuiz(JSON.stringify(dup))).toBeNull();
    // order containing a non-permanent FDI
    const bad = JSON.parse(valid) as QuizProgress;
    bad.order[0] = 99;
    expect(parseQuiz(JSON.stringify(bad))).toBeNull();
    // index out of range
    const outOfRange = JSON.parse(valid) as QuizProgress;
    outOfRange.index = QUIZ_SIZE + 1;
    expect(parseQuiz(JSON.stringify(outOfRange))).toBeNull();
    // answers with a foreign FDI
    const badAnswer = JSON.parse(valid) as QuizProgress;
    badAnswer.answers[2] = 0;
    expect(parseQuiz(JSON.stringify(badAnswer))).toBeNull();
    // hint not a boolean
    const badHint = JSON.parse(valid) as QuizProgress;
    badHint.hint = 'yes' as unknown as boolean;
    expect(parseQuiz(JSON.stringify(badHint))).toBeNull();
    // board with an arch crossing the row boundary
    const badBoard = JSON.parse(valid) as QuizProgress;
    [badBoard.board[0], badBoard.board[16]] = [badBoard.board[16], badBoard.board[0]];
    expect(parseQuiz(JSON.stringify(badBoard))).toBeNull();
    // revealed flags not matching the session size
    const badRevealed = JSON.parse(valid) as QuizProgress;
    badRevealed.revealed = [true];
    expect(parseQuiz(JSON.stringify(badRevealed))).toBeNull();
    // shuffle not a boolean
    const badShuffle = JSON.parse(valid) as QuizProgress;
    badShuffle.shuffle = 1 as unknown as boolean;
    expect(parseQuiz(JSON.stringify(badShuffle))).toBeNull();
  });
});

describe('sessionStorage persistence', () => {
  const makeStorage = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    } as unknown as Storage;
  };
  let storage: Storage;

  beforeEach(() => {
    storage = makeStorage();
    (globalThis as { sessionStorage?: Storage }).sessionStorage = storage;
  });

  afterEach(() => {
    delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
  });

  it('saves and re-loads a session', () => {
    const q = submitAnswer(createQuiz(seeded(4)), PERMANENT_FDI[9]);
    expect(loadSavedQuiz()).toBeNull();
    saveQuiz(q);
    expect(storage.getItem(QUIZ_STORAGE_KEY)).toBe(serializeQuiz(q));
    expect(loadSavedQuiz()).toEqual(q);
  });

  it('clears the saved session', () => {
    saveQuiz(createQuiz(seeded(6)));
    clearSavedQuiz();
    expect(storage.getItem(QUIZ_STORAGE_KEY)).toBeNull();
    expect(loadSavedQuiz()).toBeNull();
  });

  it('tolerates a storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    } as unknown as Storage;
    (globalThis as { sessionStorage?: Storage }).sessionStorage = broken;
    expect(loadSavedQuiz()).toBeNull();
    expect(() => saveQuiz(createQuiz(seeded(8)))).not.toThrow();
    expect(() => clearSavedQuiz()).not.toThrow();
  });

  it('returns null when sessionStorage is unavailable', () => {
    delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
    expect(loadSavedQuiz()).toBeNull();
    expect(() => saveQuiz(createQuiz(seeded(8)))).not.toThrow();
  });
});