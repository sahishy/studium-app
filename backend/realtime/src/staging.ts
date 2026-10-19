import { issueAdmission } from "./admission";
import { getGameMode } from "./games/registry";
import { matchRegion } from "./network";
import { requestRoom } from "./utils";

// Explicitly enabled only on the isolated staging Worker. Production always returns 404.
export const stagingRequest = async (request: Request, env: Env): Promise<Response | null> => {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/__test/")) return null;
  if (env.STAGING_TEST_ENABLED !== "1" || !env.STAGING_TEST_SECRET || !env.GAME_ADMISSION_SECRET) return new Response("Not found", { status: 404 });
  const authorization = request.headers.get("Authorization") ?? "";
  const expected = `Bearer ${env.STAGING_TEST_SECRET}`;
  const digest = (value: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [a, b] = await Promise.all([digest(authorization), digest(expected)]);
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left[i] ^ right[i];
  if (mismatch) return new Response("Unauthorized", { status: 401 });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const body = await request.json<any>();
  if (url.pathname === "/__test/rooms") {
    const mode = getGameMode(body.modeId);
    if (!mode || mode.playerCount !== 2) return new Response("Invalid mode", { status: 400 });
    const roomId = `load_${crypto.randomUUID()}`;
    const players = [0, 1].map((index) => ({ userId: `${roomId}_p${index}`, displayName: `Test ${index + 1}`, profilePicture: null, networkRegion: "enam" as const,
      ...(body.bot && index === 1 ? { isBot: true } : {}) }));
    const questions = Array.from({ length: 10 }, (_, index) => ({ id: `test-q${index}`, prompt: "Choose A", questionType: "mcq", difficulty: "Medium", choices: [{ id: "A", label: "A" }, { id: "B", label: "B" }], correctAnswer: "A" }));
    const initialized = await requestRoom(env.GAME, roomId, { type: "game.initialize", modeId: mode.id, ranked: false, players, testQuestions: questions, testExercise: body.exercise !== false }, matchRegion(players));
    if (!initialized.ok) return initialized;
    const viewers = Array.from({ length: Math.min(5, Math.max(0, Number(body.spectators) || 0)) }, (_, index) => ({ userId: `${roomId}_viewer${index}` }));
    const credentials = await Promise.all([...players.filter((p) => !p.isBot), ...viewers].map(async (player) => ({ userId: player.userId,
      admission: await issueAdmission(env.GAME_ADMISSION_SECRET, player.userId, roomId) })));
    return Response.json({ roomId, modeId: mode.id, players: credentials.slice(0, players.filter((p) => !p.isBot).length), spectators: credentials.slice(players.filter((p) => !p.isBot).length) });
  }
  if (url.pathname === "/__test/command" && typeof body.roomId === "string" && /^load_[a-z0-9-]+$/.test(body.roomId)) {
    if (!["stats", "deadline", "finish", "dispose", "flightWindow"].includes(body.command)) return new Response("Invalid command", { status: 400 });
    return requestRoom(env.GAME, body.roomId, { type: "game.testCommand", command: body.command });
  }
  return new Response("Not found", { status: 404 });
};
