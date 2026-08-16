import type { StoredGame } from "../games/contracts";
import { between, clamp, randomFor } from "./random";
import type { BotRuntime } from "./types";

const stripHtml = (value: unknown) => String(value ?? "").replace(/<[^>]+>/g, " ").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim();
const words = (value: unknown) => stripHtml(value).split(/\s+/).filter(Boolean).length;

export const satAccuracy = (question: any, elo: number, bot: BotRuntime) => {
  const target = question?.difficulty === "Easy" ? 100 : question?.difficulty === "Hard" ? 1000 : 550;
  const base = 1 / (1 + Math.exp(-(elo - target) / 260));
  const moduleBonus = question?.module === bot.traits.moduleAffinity ? 0.045 : -0.025;
  const sprPenalty = String(question?.questionType).toLowerCase() === "spr" ? 0.06 : 0;
  const passagePenalty = Math.min(0.08, words(question?.paragraph) / 2500);
  const nativeAccuracy = clamp(base + moduleBonus + bot.traits.skillBias - sprPenalty - passagePenalty, 0.18, 0.96);
  const human = bot.humanProfile?.questions;
  if (!human?.answers) return nativeAccuracy;
  const humanEstimate = (human.correct + 1.5) / (human.answers + 3);
  return clamp(nativeAccuracy * 0.42 + humanEstimate * 0.58, 0.18, 0.96);
};

export const satAnswerDelayMs = (question: any, elo: number, bot: BotRuntime) => {
  const wordCount = [question?.prompt, question?.body, question?.paragraph, ...(question?.choices ?? []).map((c: any) => c.label)]
    .reduce((sum, value) => sum + words(value), 0);
  const wpm = 150 + (clamp(elo, 0, 1600) / 1600) * 100;
  const reading = (wordCount / wpm) * 60_000;
  const solve = question?.difficulty === "Easy" ? 6_000 : question?.difficulty === "Hard" ? 22_000 : 12_000;
  const typeFactor = (question?.module === "math" ? 1.15 : 1) * (question?.questionType === "spr" ? 1.2 : 1);
  const noise = between(bot, 0.82, 1.28 + (1 - bot.traits.consistency) * 0.2);
  return Math.max(2_500, (reading + solve * typeFactor + between(bot, 600, 1_800)) * bot.traits.pace * noise);
};

const incorrectResponse = (question: any, bot: BotRuntime) => {
  if (question?.questionType === "mcq") {
    const wrong = (question.choices ?? []).map((choice: any) => String(choice.id)).filter((id: string) => id !== question.correctAnswer);
    return wrong[Math.floor(randomFor(bot) * wrong.length)] ?? "A";
  }
  const forbidden = new Set(question?.acceptableAnswersComparable ?? []);
  let value = String(Math.round(between(bot, -20, 50) * 10) / 10);
  while (forbidden.has(value.toLowerCase().replace(/\s+/g, ""))) value = String(Number(value) + 1);
  return value;
};

export const planSatAnswer = (game: StoredGame, bot: BotRuntime, now: number) => {
  const questionId = game.state.currentQuestionId as string | null;
  const question = game.privateState.questionsById?.[questionId ?? ""];
  const player = game.players.find((entry) => entry.userId === bot.userId);
  if (!questionId || !question || !player || (player.state.answeredQuestionIds as string[] | undefined)?.includes(questionId)) return null;
  const activeAt = Number(game.state.currentQuestionActiveAt ?? game.state.currentRoundStartedAt ?? now);
  const deadline = Number(game.state.currentQuestionDeadlineAt ?? game.state.currentRoundDeadlineAt ?? now + 120_000);
  const elo = Number(player.elo ?? player.eloByMode?.[game.modeId]) || 0;
  const correct = randomFor(bot) < satAccuracy(question, elo, bot);
  const response = correct ? String(question.correctAnswerDisplay ?? question.correctAnswer) : incorrectResponse(question, bot);
  const nativeDelay = satAnswerDelayMs(question, elo, bot);
  const humanQuestions = bot.humanProfile?.questions;
  const difficulty = (["Easy", "Medium", "Hard"].includes(question.difficulty) ? question.difficulty : "Medium") as "Easy" | "Medium" | "Hard";
  const learnedDelay = humanQuestions?.answerMsByDifficulty?.[difficulty] ?? humanQuestions?.answerMsEwma ?? null;
  const competitiveDelay = learnedDelay == null
    ? nativeDelay
    : nativeDelay * 0.35 + learnedDelay * 0.65 * between(bot, 0.9, 1.12);
  const at = Math.min(deadline - 150, activeAt + Math.max(2_500, competitiveDelay));
  return at > now ? { at, response, questionId } : { at: now + 50, response, questionId };
};
