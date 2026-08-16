import type { BotRuntime } from "./types";

export const hashValue = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const randomFor = (bot: BotRuntime) => {
  bot.randomCounter += 1;
  let state = hashValue(`${bot.seed}:${bot.randomCounter}`) || 1;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4294967296;
};

export const between = (bot: BotRuntime, min: number, max: number) => min + randomFor(bot) * (max - min);
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
