import usernames from "../../../../frontend/src/data/usernames.json";
import cosmetics from "../../../functions/src/features/economy/cosmeticCatalog.json";
import type { PlayerIdentity } from "../types";
import { hashValue } from "./random";
import type { BotRuntime, BotTraits, HumanPerformanceProfile } from "./types";

export const BOT_AVATAR_COLORS = [...cosmetics.STARTER_COLORS, ...cosmetics.COLOR_CATALOG.map((item) => item.value)];
export const BOT_AVATAR_FACES = [...cosmetics.STARTER_FACES, ...cosmetics.FACE_CATALOG.map((item) => item.value)];

const rarities = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
// Rank determines the preferred rarity and a plausible amount of time spent playing.
const botRankProfiles = [
  { minElo: 1600, rarity: 4, levels: [50, 80] },
  { minElo: 1400, rarity: 4, levels: [35, 55] },
  { minElo: 1200, rarity: 3, levels: [25, 40] },
  { minElo: 900, rarity: 3, levels: [18, 30] },
  { minElo: 600, rarity: 2, levels: [10, 20] },
  { minElo: 300, rarity: 1, levels: [5, 12] },
  { minElo: 1, rarity: 0, levels: [1, 6] },
];

const pickCosmetic = <T extends { rarity: string }>(pool: T[], preferredRarity: number, random: () => number): T => {
  // Every available item is eligible. Lower ranks overwhelmingly use simpler cosmetics;
  // higher ranks prefer rare ones, while still sometimes wearing a favorite common item.
  const weights = pool.map((item) => 0.18 ** Math.abs(rarities.indexOf(item.rarity) - preferredRarity));
  let ticket = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < pool.length; index += 1) {
    ticket -= weights[index];
    if (ticket < 0) return pool[index];
  }
  return pool[pool.length - 1];
};

const botColors = [
  ...cosmetics.STARTER_COLORS.map((value) => ({ value, rarity: "Common" })),
  ...cosmetics.COLOR_CATALOG,
];
const botFaces = [
  ...cosmetics.STARTER_FACES.map((value) => ({ value, rarity: "Common" })),
  ...cosmetics.FACE_CATALOG,
];

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

/** Rating a bot opponent should be built at. Normally it tracks the player's own rating so the
 *  match is competitive. While the player is still placing, it instead follows the placement
 *  ladder supplied by the backend: an unplaced account is rated 0, and a bot built from that would
 *  be trivially weak, so three placement matches would put every player in the same rank. */
export const botTargetElo = (human: PlayerIdentity, modeId: string) => {
  const placement = human.placementByMode?.[modeId];
  if (placement && !placement.placed && Number.isFinite(Number(placement.nextOpponentElo))) {
    return Math.max(0, Number(placement.nextOpponentElo));
  }
  return Number(human.elo ?? human.eloByMode?.[modeId]) || 0;
};

export const createBotIdentity = (human: PlayerIdentity, modeId: string, gameSeed: string = crypto.randomUUID()): PlayerIdentity => {
  const random = seeded(hashValue(gameSeed));
  const adjective = usernames.adjectives[Math.floor(random() * usernames.adjectives.length)];
  const noun = usernames.nouns[Math.floor(random() * usernames.nouns.length)];
  const digits = Math.floor(random() * 100000).toString().padStart(5, "0");
  const elo = Math.round(Math.max(1, Math.min(1600, botTargetElo(human, modeId) + normal(random) * 60)));
  const rankProfile = botRankProfiles.find((profile) => elo >= profile.minElo)!;
  const color = pickCosmetic(botColors, rankProfile.rarity, random);
  const face = pickCosmetic(botFaces, rankProfile.rarity, random);
  const title = pickCosmetic(cosmetics.TITLE_CATALOG, rankProfile.rarity, random);
  const [minLevel, maxLevel] = rankProfile.levels;
  const level = minLevel + Math.floor(random() * (maxLevel - minLevel + 1));
  return {
    userId: crypto.randomUUID(),
    displayName: `${adjective}${noun}${digits}`,
    profilePicture: null,
    avatar: {
      color: color.value,
      face: face.value,
    },
    elo,
    eloByMode: { [modeId]: elo },
    level,
    title: title.id,
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
