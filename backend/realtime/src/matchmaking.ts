import type { QueueEntry } from "./types";

const BASE_ELO_RANGE = 60;
const ELO_RANGE_STEP = 60;
const ELO_RANGE_STEP_MS = 10_000;
const UNRESTRICTED_AFTER_MS = 60_000;
export const BOT_FILL_AFTER_MS = 15_000;

export const findBotFillEntries = (queue: QueueEntry[], now = Date.now()) => [...queue]
  .filter((entry) => entry.userIds.length === 1 && now - entry.joinedAt >= BOT_FILL_AFTER_MS)
  .sort((a, b) => a.joinedAt - b.joinedAt);

export const allowedEloDifference = (joinedAt: number, now = Date.now()) => {
  const waited = Math.max(0, now - joinedAt);
  if (waited >= UNRESTRICTED_AFTER_MS) return Number.POSITIVE_INFINITY;
  return BASE_ELO_RANGE + Math.floor(waited / ELO_RANGE_STEP_MS) * ELO_RANGE_STEP;
};

type Combination = { entries: QueueEntry[]; ratingDifference: number; joinedAtTotal: number };

export const findMatch = (queue: QueueEntry[], playerCount: number, now = Date.now()): QueueEntry[] | null => {
  if (playerCount < 1 || queue.length === 0) return null;
  const ordered = [...queue].sort((a, b) => a.joinedAt - b.joinedAt);
  const anchor = ordered[0];
  if (anchor.userIds.length > playerCount) return null;
  const allowed = allowedEloDifference(anchor.joinedAt, now);
  const candidates = ordered.slice(1).filter((entry) => (
    Math.abs(entry.averageElo - anchor.averageElo) <= allowed
  ));
  const matches: Combination[] = [];

  const visit = (index: number, selected: QueueEntry[], count: number) => {
    if (count === playerCount) {
      const entries = [anchor, ...selected];
      const weightedAverage = entries.reduce((sum, entry) => sum + entry.averageElo * entry.userIds.length, 0) / playerCount;
      matches.push({
        entries,
        ratingDifference: entries.reduce((sum, entry) => sum + Math.abs(entry.averageElo - weightedAverage) * entry.userIds.length, 0) / playerCount,
        joinedAtTotal: entries.reduce((sum, entry) => sum + entry.joinedAt * entry.userIds.length, 0) / playerCount,
      });
      return;
    }
    if (index >= candidates.length || count > playerCount) return;
    for (let i = index; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      if (count + candidate.userIds.length <= playerCount) {
        visit(i + 1, [...selected, candidate], count + candidate.userIds.length);
      }
    }
  };

  visit(0, [], anchor.userIds.length);
  matches.sort((a, b) => a.ratingDifference - b.ratingDifference || a.joinedAtTotal - b.joinedAtTotal);
  return matches[0]?.entries ?? null;
};

export const averageElo = (values: number[]) => values.length
  ? Math.round(values.reduce((sum, value) => sum + (Number(value) || 0), 0) / values.length)
  : 0;
