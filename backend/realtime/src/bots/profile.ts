import usernames from "../../../../frontend/src/data/usernames.json";
import type { PlayerIdentity } from "../types";
import { hashValue } from "./random";
import type { BotRuntime, BotTraits, HumanPerformanceProfile } from "./types";

export const BOT_AVATAR_COLORS = ["#fcd34d", "#22c55e", "#60a5fa", "#f87171"] as const;

const seeded = (seed: number) => {
  let state = seed || 1;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
};

const normal = (random: () => number) => {
  const a = Math.max(Number.EPSILON, random());
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * random());
};

export const createBotIdentity = (human: PlayerIdentity, modeId: string, gameSeed: string = crypto.randomUUID()): PlayerIdentity => {
  const random = seeded(hashValue(gameSeed));
  const adjective = usernames.adjectives[Math.floor(random() * usernames.adjectives.length)];
  const noun = usernames.nouns[Math.floor(random() * usernames.nouns.length)];
  const digits = Math.floor(random() * 100000).toString().padStart(5, "0");
  const humanElo = Number(human.elo ?? human.eloByMode?.[modeId]) || 0;
  const elo = Math.round(Math.max(0, Math.min(1600, humanElo + normal(random) * 60)));
  return {
    userId: crypto.randomUUID(),
    displayName: `${adjective}${noun}${digits}`,
    profilePicture: null,
    avatar: {
      color: BOT_AVATAR_COLORS[Math.floor(random() * BOT_AVATAR_COLORS.length)],
      face: Math.floor(random() * 3),
    },
    elo,
    eloByMode: { [modeId]: elo },
    isBot: true,
  };
};

export const createHumanPerformanceProfile = (userId: string): HumanPerformanceProfile => ({
  userId,
  questions: {
    questionIds: [], answers: 0, correct: 0, accuracyEwma: null, answerMsEwma: null,
    answerMsByDifficulty: { Easy: null, Medium: null, Hard: null },
  },
  minigame: {
    actions: 0, successes: 0, mistakes: 0, lastActionAt: null, lastRoundKey: null, intervalEwma: null,
    accuracyEwma: null, recentMistakeBoost: 0, roundsCompleted: 0,
    puncture: {
      actionsByStage: { open: 0, crowded: 0, precision: 0 },
      intervalMsByStage: { open: null, crowded: null, precision: null },
    },
  },
  processedEventSequence: 0,
});

export const createBotRuntime = (identity: PlayerIdentity, gameId: string, humanUserId = ""): BotRuntime => {
  const seed = hashValue(`${gameId}:${identity.userId}`);
  const random = seeded(seed);
  const traits: BotTraits = {
    pace: 0.88 + random() * 0.24,
    skillBias: -0.04 + random() * 0.08,
    mistakeRate: 0.025 + random() * 0.08,
    consistency: 0.55 + random() * 0.4,
    reactionMs: 180 + random() * 420,
    moduleAffinity: random() < 0.5 ? "math" : "english",
  };
  return {
    userId: identity.userId, seed, randomCounter: 0, traits, sequence: 0, scheduled: [],
    observation: { actionCount: 0, lastActionAt: null, intervalEwma: null, mistakes: 0, recentMistakeBoost: 0 },
    humanProfile: createHumanPerformanceProfile(humanUserId),
    chat: {
      sentCount: 0,
      humanMessagesSinceReply: 0,
      nextResponseAfter: 1,
      lastBotMessageUid: null,
      lastObservedHumanMessageUid: null,
      pending: null,
    },
    rhythms: {},
  };
};
