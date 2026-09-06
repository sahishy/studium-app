import { Server } from "partyserver";
import { getGameMode } from "../games/registry";
import { botFillAt, createBotFillAt, findBotFillEntries, findMatch, nextEloWideningAt } from "../matchmaking";
import type { QueueEntry } from "../types";
import { createBotIdentity } from "../bots/profile";
import { requestRoom } from "../utils";

export class MatchmakerServer extends Server<Env> {
  queue: QueueEntry[] = [];

  async onStart() {
    this.queue = (await this.ctx.storage.get<QueueEntry[]>("queue")) ?? [];
    await this.scheduleMatchCheck();
  }

  async onRequest(request: Request) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const body = await request.json<any>();
    if (body.type === "queue.join") {
      const entry: QueueEntry = { ...body.entry, botFillAt: createBotFillAt(body.entry.joinedAt) };
      const previousQueue = this.queue;
      this.queue = [...this.queue.filter((queued) => queued.id !== entry.id), entry];
      let gameId: string | null;
      try {
        gameId = await this.match(body.requesterUserId);
      } catch (error) {
        this.queue = previousQueue;
        await this.ctx.storage.put("queue", this.queue);
        return new Response(error instanceof Error ? error.message : "Unable to create a game.", { status: 502 });
      }
      await this.ctx.storage.put("queue", this.queue);
      await this.scheduleMatchCheck();
      return Response.json({ ok: true, gameId });
    } else if (body.type === "queue.leave") {
      this.queue = this.queue.filter((entry) => entry.id !== body.entryId);
    }
    await this.ctx.storage.put("queue", this.queue);
    await this.scheduleMatchCheck();
    return Response.json({ ok: true });
  }

  async onAlarm() {
    try {
      await this.match();
    } finally {
      await this.scheduleMatchCheck();
    }
  }

  private async scheduleMatchCheck() {
    if (!this.queue.length) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const mode = getGameMode(this.name);
    const now = Date.now();
    const candidates: number[] = [];
    const anchor = [...this.queue].sort((a, b) => a.joinedAt - b.joinedAt)[0];
    const eloWideningAt = nextEloWideningAt(anchor.joinedAt, now);
    if (eloWideningAt != null) candidates.push(eloWideningAt);
    if (mode?.playerCount === 2) {
      for (const entry of this.queue) {
        if (entry.userIds.length === 1) candidates.push(Math.max(now, botFillAt(entry)));
      }
    }
    if (!candidates.length) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Math.max(now + 250, Math.min(...candidates)));
  }

  private async match(requesterUserId?: string): Promise<string | null> {
    const mode = getGameMode(this.name);
    if (!mode?.supportsPublicMatchmaking) return null;
    let requesterGameId: string | null = null;
    let selected = findMatch(this.queue, mode.playerCount);
    while (selected) {
      const selectedIds = new Set(selected.map((entry) => entry.id));
      const players = selected.flatMap((entry) => entry.players);
      const gameId = crypto.randomUUID();
      const initialized = await requestRoom(this.env.GAME, gameId, { type: "game.initialize", modeId: mode.id, ranked: mode.ranked, players });
      if (!initialized.ok) throw new Error((await initialized.text()) || "Unable to initialize the game.");
      this.queue = this.queue.filter((entry) => !selectedIds.has(entry.id));
      await this.ctx.storage.put("queue", this.queue);
      if (players.some((player) => player.userId === requesterUserId)) requesterGameId = gameId;
      await Promise.all(players.filter((player) => player.userId !== requesterUserId).map((player) => requestRoom(this.env.USER, player.userId, { type: "game.assigned", gameId, modeId: mode.id })));
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
        const initialized = await requestRoom(this.env.GAME, gameId, { type: "game.initialize", modeId: mode.id, ranked: mode.ranked, players });
        if (!initialized.ok) continue;
        this.queue = this.queue.filter((queued) => queued.id !== entry.id);
        await this.ctx.storage.put("queue", this.queue);
        if (human.userId === requesterUserId) requesterGameId = gameId;
        else await requestRoom(this.env.USER, human.userId, { type: "game.assigned", gameId, modeId: mode.id });
      }
    }
    return requesterGameId;
  }
}

export default MatchmakerServer;
