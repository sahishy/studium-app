import type { StoredGame } from "./contracts";

const comparable = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");

export const isCorrectSatAnswer = (question: any, response: string) => (
  String(question?.questionType).toLowerCase() === "spr"
    ? (question?.acceptableAnswersComparable ?? []).includes(comparable(response))
    : response.toUpperCase() === question?.correctAnswer
);

export const sanitizeSatQuestion = (question: any) => question
  ? Object.fromEntries(Object.entries(question).filter(([key]) => ![
    "correctAnswer",
    "correctAnswerDisplay",
    "acceptableAnswers",
    "acceptableAnswersComparable",
  ].includes(key)))
  : null;

export const buildReviewQuestionsById = (questionsById: Record<string, any> = {}, events: Array<Record<string, any>> = []) => {
  const resolvedIds = new Set(events
    .filter((event) => event?.type === "QUESTION_RESOLVED" || event?.type === "ROUND_RESOLVED")
    .map((event) => String(event?.data?.questionId ?? ""))
    .filter(Boolean));
  return Object.fromEntries([...resolvedIds]
    .map((questionId) => [questionId, sanitizeSatQuestion(questionsById[questionId])])
    .filter(([, question]) => Boolean(question)));
};

const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

export type SatDifficulty = (typeof DIFFICULTIES)[number];
export type SatTally = { answered: number; correct: number };

export type SatPlayerPerformance = {
  faced: number;
  answered: number;
  correct: number;
  totalAnswerMs: number;
  roundsWon: number;
  byDomain: Record<string, SatTally>;
  byDifficulty: Record<string, SatTally>;
};

const emptyTally = (): SatTally => ({ answered: 0, correct: 0 });

const emptyPerformance = (): SatPlayerPerformance => ({
  faced: 0,
  answered: 0,
  correct: 0,
  totalAnswerMs: 0,
  roundsWon: 0,
  byDomain: {},
  byDifficulty: { Easy: emptyTally(), Medium: emptyTally(), Hard: emptyTally() },
});

const normalizedDifficulty = (value: unknown): SatDifficulty => (
  (DIFFICULTIES as readonly string[]).includes(String(value)) ? String(value) as SatDifficulty : "Medium"
);

// Question telemetry lives in privateState: it survives hibernation, is never published to a
// client, and is read out once by buildSatPerformance when the match finishes. A match already in
// flight when this shipped simply starts accumulating from zero, so every consumer treats a
// missing or partial tally as "no data" rather than as a score.
const performanceStore = (game: StoredGame): Record<string, SatPlayerPerformance> => (
  game.privateState.satPerformanceByUserId ??= {}
);

const performanceFor = (game: StoredGame, userId: string) => {
  const store = performanceStore(game);
  return (store[userId] ??= emptyPerformance());
};

export const recordSatAnswer = (
  game: StoredGame,
  userId: string,
  question: any,
  outcome: { isCorrect: boolean; elapsedMs?: number | null },
) => {
  const performance = performanceFor(game, userId);
  const correct = Number(Boolean(outcome.isCorrect));
  const elapsedMs = Number(outcome.elapsedMs);

  performance.answered += 1;
  performance.correct += correct;
  if (Number.isFinite(elapsedMs) && elapsedMs >= 0) performance.totalAnswerMs += elapsedMs;

  const byDifficulty = (performance.byDifficulty[normalizedDifficulty(question?.difficulty)] ??= emptyTally());
  byDifficulty.answered += 1;
  byDifficulty.correct += correct;

  // Mastery is keyed on the SAT domain, so a question that arrived without one contributes to
  // the overall tallies but cannot be attributed to an axis of the skill web.
  const domain = String(question?.domain ?? "").trim();
  if (!domain) return;

  const byDomain = (performance.byDomain[domain] ??= emptyTally());
  byDomain.answered += 1;
  byDomain.correct += correct;
};

// Counted against every player once a question resolves, whether they answered or not, so
// letting the clock run out cannot inflate accuracy by only answering the questions you know.
export const recordSatQuestionFaced = (game: StoredGame, questionId: string) => {
  if (!String(questionId ?? "")) return;
  for (const player of game.players) performanceFor(game, player.userId).faced += 1;
};

export const recordSatRoundWin = (game: StoredGame, userId: string | null) => {
  if (!userId) return;
  performanceFor(game, userId).roundsWon += 1;
};

// The telemetry fields every SAT mode attaches to its result. Kept here rather than repeated in
// four finish() implementations so a new signal only has to be added once.
export const buildSatResultTelemetry = (game: StoredGame) => ({
  performanceByUserId: buildSatPerformance(game),
  eloByUserId: Object.fromEntries(game.players.map((player) => [
    player.userId,
    Number(player.elo ?? player.eloByMode?.[game.modeId]) || 0,
  ])),
});

export const buildSatPerformance = (game: StoredGame) => Object.fromEntries(
  game.players.map((player) => {
    const performance = performanceStore(game)[player.userId] ?? emptyPerformance();
    return [player.userId, {
      faced: performance.faced,
      answered: performance.answered,
      correct: performance.correct,
      roundsWon: performance.roundsWon,
      avgAnswerMs: performance.answered ? Math.round(performance.totalAnswerMs / performance.answered) : null,
      byDomain: performance.byDomain,
      byDifficulty: performance.byDifficulty,
    }];
  }),
);
