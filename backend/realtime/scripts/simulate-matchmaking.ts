import { findMatch } from "../src/matchmaking";
import type { QueueEntry } from "../src/types";

const entry = (id: string, count: number, elo: number, joinedAt: number): QueueEntry => ({
  id, averageElo: elo, joinedAt,
  userIds: Array.from({ length: count }, (_, index) => `${id}-${index}`),
  players: Array.from({ length: count }, (_, index) => ({ userId: `${id}-${index}`, displayName: id, profilePicture: null, elo })),
});

const now = 100_000;
const cases = [
  ["1v1", [entry("a", 1, 500, now - 1_000), entry("b", 1, 540, now)], 2],
  ["four solo", [entry("a", 1, 500, 1), entry("b", 1, 510, 2), entry("c", 1, 520, 3), entry("d", 1, 530, 4)], 4],
  ["party plus solos", [entry("party", 2, 500, 1), entry("a", 1, 505, 2), entry("b", 1, 515, 3)], 4],
] as const;

for (const [name, queue, count] of cases) {
  const match = findMatch([...queue], count, now);
  if (!match || match.reduce((sum, item) => sum + item.userIds.length, 0) !== count) throw new Error(`Failed: ${name}`);
  console.log(`✓ ${name}: ${match.map((item) => item.id).join(", ")}`);
}
