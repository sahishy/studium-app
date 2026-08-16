import type * as Party from "partykit/server";
import { getGameMode } from "../games/registry";
import { BOT_FILL_AFTER_MS, findBotFillEntries, findMatch } from "../matchmaking";
import type { QueueEntry } from "../types";
import { createBotIdentity } from "../bots/profile";

export default class MatchmakerServer implements Party.Server {
  queue: QueueEntry[] = [];
  matchTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(readonly room: Party.Room) {}

  async onStart() {
    this.queue = (await this.room.storage.get<QueueEntry[]>("queue")) ?? [];
    this.scheduleMatchCheck();
  }

  async onRequest(request: Party.Request) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const body = await request.json<any>();
    if (body.type === "queue.join") {
      const previousQueue = this.queue;
      this.queue = [...this.queue.filter((entry) => entry.id !== body.entry.id), body.entry];
      let gameId: string | null;
      try {
        gameId = await this.match(body.requesterUserId);
      } catch (error) {
        this.queue = previousQueue;
        await this.room.storage.put("queue", this.queue);
        return new Response(error instanceof Error ? error.message : "Unable to create a game.", { status: 502 });
      }
      await this.room.storage.put("queue", this.queue);
      this.scheduleMatchCheck();
      return Response.json({ ok: true, gameId });
    } else if (body.type === "queue.leave") {
      this.queue = this.queue.filter((entry) => entry.id !== body.entryId);
    }
    await this.room.storage.put("queue", this.queue);
    this.scheduleMatchCheck();
    return Response.json({ ok: true });
  }

  private scheduleMatchCheck() {
    if (this.matchTimer) clearTimeout(this.matchTimer);
    this.matchTimer = null;
    if (!this.queue.length) return;
    const untilBotFill = Math.max(0, Math.min(...this.queue.map((entry) => entry.joinedAt + BOT_FILL_AFTER_MS - Date.now())));
    const delay = untilBotFill === 0 ? 5_000 : Math.min(10_000, untilBotFill);
    this.matchTimer = setTimeout(() => {
      this.matchTimer = null;
      void this.match().finally(() => this.scheduleMatchCheck());
    }, delay);
  }

  private async match(requesterUserId?: string): Promise<string | null> {
    const mode = getGameMode(this.room.id);
    if (!mode?.supportsPublicMatchmaking) return null;
    let requesterGameId: string | null = null;
    let selected = findMatch(this.queue, mode.playerCount);
    while (selected) {
      const selectedIds = new Set(selected.map((entry) => entry.id));
      const players = selected.flatMap((entry) => entry.players);
      const gameId = crypto.randomUUID();
      const initialized = await this.room.context.parties.game.get(gameId).fetch({
        method: "POST", body: JSON.stringify({ type: "game.initialize", modeId: mode.id, ranked: mode.ranked, players }),
      });
      if (!initialized.ok) throw new Error((await initialized.text()) || "Unable to initialize the game.");
      this.queue = this.queue.filter((entry) => !selectedIds.has(entry.id));
      await this.room.storage.put("queue", this.queue);
      if (players.some((player) => player.userId === requesterUserId)) requesterGameId = gameId;
      await Promise.all(players.filter((player) => player.userId !== requesterUserId).map((player) => this.room.context.parties.user.get(player.userId).fetch({
        method: "POST", body: JSON.stringify({ type: "game.assigned", gameId, modeId: mode.id }),
      })));
      selected = findMatch(this.queue, mode.playerCount);
    }

    if (mode.playerCount === 2) {
      const staleEntries = findBotFillEntries(this.queue);
      for (const entry of staleEntries) {
        if (!this.queue.some((queued) => queued.id === entry.id)) continue;
        const human = entry.players[0];
        const bot = createBotIdentity(human, mode.id, `${entry.id}:${entry.joinedAt}`);
        const players = [human, bot];
        const gameId = crypto.randomUUID();
        const initialized = await this.room.context.parties.game.get(gameId).fetch({
          method: "POST", body: JSON.stringify({ type: "game.initialize", modeId: mode.id, ranked: mode.ranked, players }),
        });
        if (!initialized.ok) continue;
        this.queue = this.queue.filter((queued) => queued.id !== entry.id);
        await this.room.storage.put("queue", this.queue);
        if (human.userId === requesterUserId) requesterGameId = gameId;
        else await this.room.context.parties.user.get(human.userId).fetch({
          method: "POST", body: JSON.stringify({ type: "game.assigned", gameId, modeId: mode.id }),
        });
      }
    }
    return requesterGameId;
  }
}
