import { env, exports } from "cloudflare:workers";
import { reset, runInDurableObject } from "cloudflare:test";
import { afterEach, expect, it, vi } from "vitest";
import type { GameServer } from "./servers/game";
import { issueAdmission } from "./admission";
const runtime = env as Env;
const questions = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, prompt: "Choose A", questionType: "mcq", choices: [{ id: "A", label: "A" }], correctAnswer: "A", difficulty: "Medium" }));
afterEach(async () => { vi.restoreAllMocks(); await reset(); });
const fixture = async (modeId = "sat-timber", arcade = true) => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if(url.pathname.endsWith("questions")) return Response.json({ questions });
    if(url.pathname.endsWith("verify")) {
      const token = new Headers(input instanceof Request ? input.headers : init?.headers).get("Authorization")?.replace("Bearer ", "");
      return Response.json({ userId: token, displayName: token, profilePicture: null });
    }
    return Response.json({ eloDeltaByUserId: {}, rewardsByUserId: {} });
  });
  const gameId = crypto.randomUUID(), stub = runtime.GAME.getByName(gameId);
  await stub.fetch(new Request("https://internal.invalid/init", { method: "POST", body: JSON.stringify({ type: "game.initialize", modeId, ranked: false,
    players: ["p1", "p2"].map((userId) => ({ userId, displayName: userId, profilePicture: null })) }) }));
  await runInDurableObject(stub, async (instance: GameServer) => {
    const g = instance.game!, server = instance as any, now = Date.now();
    g.privateState.netcodeVersion = 4; g.state.introEndsAt = now - 1; g.state.currentQuestionActiveAt = now - 1_000;
    if(arcade) {
      const engine = server.engine();
      for(const userId of ["p1", "p2"]) engine.handleAction(g, userId, { id: userId, type: "game.answer", payload: { submittedResponse: "A" } }, server.context(now));
      g.state.phaseDeadlineAt = now - 300; engine.handleDeadline(g, server.context(now - 300));
    }
    await server.afterMutation(true);
  });
  const response = await exports.default.fetch(new Request(`https://realtime.test/parties/game/${gameId}?token=p1&userId=p1&protocolVersion=4`, { headers: { Upgrade: "websocket" } }));
  expect(response.status).toBe(101);
  const socket = response.webSocket!; socket.accept();
  const send = async (type: string, payload: Record<string, unknown>) => {
    const id = crypto.randomUUID();
    const reply = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`No reply for ${type}`)), 3000);
      const listener = (event: MessageEvent) => {
        const m = JSON.parse(String(event.data));
        if(m.id !== id) return;
        clearTimeout(timer); socket.removeEventListener("message", listener); resolve(m);
      }; socket.addEventListener("message", listener);
    });
    const scope = await runInDurableObject(stub, (instance: GameServer) => ({ inputEpoch: instance.game!.state.inputEpoch, roundToken: instance.game!.state.roundToken, questionId: instance.game!.state.currentQuestionId }));
    socket.send(JSON.stringify({ id, type, payload: { ...scope, ...payload } }));
    return reply;
  };
  return { stub, socket, send, gameId };
};
it("applies a Flutter key release after an overdue ring deadline", async () => {
  const f = await fixture("sat-flutter");
  await runInDurableObject(f.stub, (instance: GameServer) => {
    const g = instance.game!, now = Date.now();
    g.state.flutterCurrentRingPassAt = now - 20; g.state.phaseDeadlineAt = now - 1;
    g.players[0].state.flutterInput = { up: false, down: false, left: false, right: true };
    g.players[0].state.flutterLastUpdatedAt = now - 30; g.privateState.flutterHistories = {};
  });
  expect((await f.send("game.flutterInput", { sequence: 1, occurredAt: Date.now() - 10, up: false, down: false, left: false, right: false })).payload.accepted).toBe(true);
  await runInDurableObject(f.stub, (instance: GameServer) => {
    expect(instance.game!.state.phase).toBe("flutter_active"); expect(instance.game!.state.flutterRingIndex).toBe(1);
    expect((instance.game!.players[0].state.flutterInput as any).right).toBe(false);
  });
});
it("accepts compressed valid chops, rejects fast presses, and deduplicates results", async () => {
  const f = await fixture();
  await runInDurableObject(f.stub, (instance: GameServer) => { instance.game!.privateState.branchSequence = Array(300).fill(null); });
  const at = Date.now() - 180;
  expect((await f.send("game.chop", { clientActionId: "a", sequence: 1, occurredAt: at, side: "left" })).payload.accepted).toBe(true);
  const second = await f.send("game.chop", { clientActionId: "b", sequence: 2, occurredAt: at + 60, side: "right" });
  expect(second.payload.accepted).toBe(true);
  expect((await f.send("game.chop", { clientActionId: "c", sequence: 3, occurredAt: at + 70, side: "left" })).payload.reason).toBe("rate_limited");
  expect((await f.send("game.chop", { clientActionId: "b", sequence: 2, occurredAt: at + 60, side: "right" })).payload.actualChops).toBe(second.payload.actualChops);
  await runInDurableObject(f.stub, (instance: GameServer) => expect(instance.game!.players[0].state.timberActualChops).toBe(2));
});
it("rejects stale scope and durably checkpoints answers before recovery", async () => {
  const f = await fixture("sat-timber", false);
  for(const [payload, reason] of [[{ inputEpoch: -1 }, "stale_epoch"], [{ roundToken: "old" }, "stale_round"], [{ questionId: "old" }, "stale_question"]] as const) {
    expect((await f.send("game.answer", { sequence: 1, submittedResponse: "A", ...payload })).payload.reason).toBe(reason);
  }
  expect((await f.send("game.answer", { sequence: 1, submittedResponse: "A" })).payload.accepted).toBe(true);
  await runInDurableObject(f.stub, async (instance: GameServer, state: DurableObjectState) => {
    const stored = await state.storage.get<any>("game");
    expect(stored.privateState.answersByUserId.p1.submittedResponse).toBe("A");
    const epoch = instance.game!.state.inputEpoch; await instance.onStart();
    expect(instance.game!.state.inputEpoch).toBe(epoch + 1); expect(instance.game!.players[0].state.inputSequence).toBe(-1);
  });
});
it("does not postpone timers or rewrite a live backstop during scheduling storms", async () => {
  const f = await fixture("sat-flutter");
  await runInDurableObject(f.stub, async (instance: GameServer, state: DurableObjectState) => {
    const server = instance as any; server.clearTickTimer();
    let now = Date.now(); const alarmAt = instance.scheduledAlarmAt;
    const date = vi.spyOn(Date, "now").mockImplementation(() => now);
    const alarm = vi.spyOn(state.storage, "setAlarm");
    instance.game!.state.phaseDeadlineAt = now + 100; server.armTick(); const target = server.tickDueAt;
    for(let i = 0; i < 100; i++) { now += 4; server.armTick(); await server.scheduleNextAlarm(); }
    expect(server.tickDueAt).toBe(target); expect(instance.scheduledAlarmAt).toBe(alarmAt); expect(alarm).not.toHaveBeenCalled();
    server.clearTickTimer(); date.mockRestore(); alarm.mockRestore();
  });
});
it("admits assigned players by room ticket without a Firebase token", async () => {
  const f = await fixture();
  const admission = await issueAdmission(runtime.GAME_ADMISSION_SECRET, "p1", f.gameId);
  const response = await exports.default.fetch(new Request(`https://realtime.test/parties/game/${f.gameId}?userId=p1&admission=${admission}&protocolVersion=4`, { headers: { Upgrade: "websocket" } }));
  expect(response.status).toBe(101); response.webSocket!.accept(); response.webSocket!.close(1000);
});

it("replaces a distant idle alarm with a five-second backstop when a question gets a connection", async () => {
  const f = await fixture("sat-timber", false);
  await runInDurableObject(f.stub, async (instance: GameServer) => {
    const server = instance as any;
    instance.scheduledAlarmAt = Date.now() + 120_000;
    await server.scheduleNextAlarm();
    expect(instance.scheduledAlarmAt).toBeLessThanOrEqual(Date.now() + 5000);
    expect(instance.scheduledAlarmAt).toBeGreaterThan(Date.now());
  });
});

it("writes twelve backstops per connected minute independently of scheduling volume", async () => {
  const f = await fixture("sat-timber", false);
  await runInDurableObject(f.stub, async (instance: GameServer, state: DurableObjectState) => {
    const server = instance as any;
    server.clearTickTimer();
    let now = Date.now();
    const date = vi.spyOn(Date, "now").mockImplementation(() => now);
    const writes = vi.spyOn(state.storage, "setAlarm");
    instance.scheduledAlarmAt = now + 5000;
    for(let elapsed = 100; elapsed <= 60_000; elapsed += 100) {
      now += 100;
      if(elapsed % 5000 === 0) await instance.onAlarm();
      else await server.scheduleNextAlarm();
      server.clearTickTimer();
    }
    expect(writes).toHaveBeenCalledTimes(12);
    date.mockRestore(); writes.mockRestore();
  });
});

it("scores answers at receipt time even when loading work delays the action handler", async () => {
  const f = await fixture("sat-timber", false);
  await runInDurableObject(f.stub, (instance: GameServer) => {
    vi.spyOn(instance as any, "ensureQuestionsLoaded").mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 20)));
  });
  const reply = await f.send("game.answer", { sequence: 1, submittedResponse: "A" });
  expect(reply.payload.accepted).toBe(true);
  await runInDurableObject(f.stub, async (instance: GameServer) => {
    await instance.mutationTail;
    expect(instance.game!.privateState.answersByUserId.p1.submittedAt).toBe(reply.payload.serverReceivedAt);
  });
});

it("publishes the final state and releases sessions while result settlement is delayed", async () => {
  const f = await fixture("sat-timber", false);
  const original = vi.mocked(globalThis.fetch).getMockImplementation()!;
  let settlementStarted = false;
  vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if(!url.pathname.endsWith("results")) return original(input, init);
    settlementStarted = true;
    await new Promise((resolve) => setTimeout(resolve, 200));
    return Response.json({ rewardsByUserId: { p1: { xp: 1, lumen: 0 } } });
  });
  const finished = new Promise<void>((resolve) => f.socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if(message.type === "game.update" && message.payload.room?.status === "finished" || message.type === "game.snapshot" && message.payload.room.status === "finished") resolve();
  }));
  f.socket.send(JSON.stringify({ id: "leave", type: "game.leave", payload: {} }));
  await finished;
  expect(settlementStarted).toBe(true);
  expect((await f.send("system.clockPing", { clientMonotonic: 1 })).type).toBe("system.clockPong");
  await runInDurableObject(f.stub, async (instance: GameServer) => {
    expect(instance.game!.privateState.resultCommitted).not.toBe(true);
    await instance.terminalWork;
    expect(instance.game!.privateState.playerSessionsReleased).toBe(true);
    expect(instance.game!.privateState.resultCommitted).toBe(true);
  });
});

it("serializes batched controls across checkpoint awaits without rejecting fresh sequences", async () => {
  const f = await fixture("sat-flutter");
  const scope = await runInDurableObject(f.stub, (instance: GameServer) => {
    (instance as any).lastCheckpointAt = 0;
    return { inputEpoch: instance.game!.state.inputEpoch, roundToken: instance.game!.state.roundToken };
  });
  const replies: any[] = [];
  const done = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Batched replies timed out")), 3000);
    f.socket.addEventListener("message", (event) => {
      const m = JSON.parse(String(event.data));
      if(!String(m.id).startsWith("batch-")) return;
      replies.push(m.payload);
      if(replies.length === 6) { clearTimeout(timeout); resolve(); }
    });
  });
  const occurredAt = Date.now();
  for(let sequence = 1; sequence <= 6; sequence++) f.socket.send(JSON.stringify({ id: `batch-${sequence}`, type: "game.flutterInput", payload: { ...scope, sequence, occurredAt, up: false, down: false, left: false, right: false } }));
  await done;
  expect(replies.map((reply) => reply.sequence)).toEqual([1, 2, 3, 4, 5, 6]);
  expect(replies.every((reply) => reply.accepted)).toBe(true);
});
