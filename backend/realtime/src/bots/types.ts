import type { RealtimeMessage } from "../types";

export type BotTraits = {
  pace: number;
  skillBias: number;
  mistakeRate: number;
  consistency: number;
  reactionMs: number;
  moduleAffinity: "math" | "english";
};

export type BotObservation = {
  actionCount: number;
  lastActionAt: number | null;
  intervalEwma: number | null;
  mistakes: number;
  recentMistakeBoost: number;
};

export type PunctureCrowdingStage = "open" | "crowded" | "precision";

export type PuncturePaceProfile = {
  actionsByStage: Record<PunctureCrowdingStage, number>;
  intervalMsByStage: Record<PunctureCrowdingStage, number | null>;
};

export type HumanPerformanceProfile = {
  userId: string;
  questions: {
    questionIds: string[];
    answers: number;
    correct: number;
    accuracyEwma: number | null;
    answerMsEwma: number | null;
    answerMsByDifficulty: Record<"Easy" | "Medium" | "Hard", number | null>;
  };
  minigame: {
    actions: number;
    successes: number;
    mistakes: number;
    lastActionAt: number | null;
    lastRoundKey: string | null;
    intervalEwma: number | null;
    accuracyEwma: number | null;
    recentMistakeBoost: number;
    roundsCompleted: number;
    puncture: PuncturePaceProfile;
  };
  processedEventSequence: number;
};

export type BotScheduledAction = {
  id: string;
  at: number;
  phaseKey: string;
  kind: "game" | "chat_send";
  message?: RealtimeMessage;
  text?: string;
  chatJobId?: string;
};

export type BotChatPendingJob = {
  id: string;
  revision: number;
  status: "debouncing" | "generating" | "typing";
  debounceAt: number;
  expiresAt: number;
  sourceThroughMessageUid: string;
  generationStartedAt?: number;
};

export type BotChatState = {
  sentCount: number;
  humanMessagesSinceReply: number;
  nextResponseAfter: number;
  lastBotMessageUid: string | null;
  lastObservedHumanMessageUid: string | null;
  pending: BotChatPendingJob | null;
};

export type BotRhythm = {
  multiplier: number;
  actionsRemaining: number;
};

export type BotRuntime = {
  userId: string;
  seed: number;
  randomCounter: number;
  traits: BotTraits;
  observation: BotObservation;
  humanProfile: HumanPerformanceProfile;
  chat: BotChatState;
  rhythms: Record<string, BotRhythm>;
  scheduled: BotScheduledAction[];
  sequence: number;
  lastPlannedQuestionId?: string | null;
  flutterMissRing?: number | null;
  lastFlutterPlannedRing?: number | null;
  flutterAimX?: number | null;
  flutterAimY?: number | null;
  skippedQuestionId?: string | null;
};
