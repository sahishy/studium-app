import { Server } from "partyserver";
import { answerChatMessage, type BotChatGenerationRequest } from "../bots/chat";
import { requestRoom } from "../utils";

type StoredBotChatJob = {
  gameId: string;
  botUserId: string;
  jobId: string;
  revision: number;
  dueAt: number;
};

export class BotChatServer extends Server<Env> {
  private async finishJob(job: StoredBotChatJob) {
    const current = await this.ctx.storage.get<StoredBotChatJob>("job");
    if (!current) return;
    if (current.jobId === job.jobId && current.revision === job.revision) {
      await this.ctx.storage.deleteAll();
    } else {
      await this.ctx.storage.setAlarm(current.dueAt);
    }
  }

  async onRequest(request: Request) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const body = await request.json<any>();
    if (body.type !== "bot.chatSchedule") return new Response("Unknown request", { status: 400 });
    const job: StoredBotChatJob = {
      gameId: String(body.gameId ?? ""),
      botUserId: String(body.botUserId ?? ""),
      jobId: String(body.jobId ?? ""),
      revision: Number(body.revision),
      dueAt: Number(body.dueAt),
    };
    if (!job.gameId || job.gameId !== this.name || !job.botUserId || !job.jobId || !Number.isInteger(job.revision) || !Number.isFinite(job.dueAt)) {
      return new Response("Invalid chat job", { status: 400 });
    }
    const stored = await this.ctx.storage.get<StoredBotChatJob>("job");
    if (stored && (stored.jobId !== job.jobId || stored.revision > job.revision)) return new Response("Stale chat job", { status: 409 });
    await this.ctx.storage.put("job", job);
    await this.ctx.storage.setAlarm(job.dueAt);
    return Response.json({ ok: true });
  }

  async onAlarm() {
    const job = await this.ctx.storage.get<StoredBotChatJob>("job");
    if (!job) return;
    const now = Date.now();
    if (now < job.dueAt) {
      await this.ctx.storage.setAlarm(job.dueAt);
      return;
    }
    let contextResponse: Response;
    try {
      contextResponse = await requestRoom(this.env.GAME, job.gameId, { type: "bot.chatContext", botUserId: job.botUserId, jobId: job.jobId, revision: job.revision });
    } catch {
      await this.finishJob(job);
      return;
    }
    if (contextResponse.status === 425) {
      const { retryAt } = await contextResponse.json() as { retryAt?: number };
      if (Number.isFinite(retryAt)) {
        job.dueAt = Number(retryAt);
        await this.ctx.storage.put("job", job);
        await this.ctx.storage.setAlarm(job.dueAt);
        return;
      }
    }
    if (!contextResponse.ok) {
      await this.finishJob(job);
      return;
    }
    const { request } = await contextResponse.json() as { request?: BotChatGenerationRequest };
    const text = request
      ? await answerChatMessage(request, this.env.OPENAI_API_KEY)
      : null;
    try {
      await requestRoom(this.env.GAME, job.gameId, {
        type: text ? "bot.chatResult" : "bot.chatFailed",
        botUserId: job.botUserId,
        jobId: job.jobId,
        revision: job.revision,
        ...(text ? { text } : {}),
      });
    } catch {
      // The game room's persisted timeout clears a job whose callback cannot arrive.
    }
    await this.finishJob(job);
  }
}

export default BotChatServer;
