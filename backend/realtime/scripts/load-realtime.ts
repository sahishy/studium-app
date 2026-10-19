import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { WebSocket } from "ws";
import { createServerClock } from "../../../frontend/src/features/multiplayer/services/serverClock.js";
import { applyRoomPatch, applyStatePatch, appendById } from "../../../frontend/src/features/multiplayer/services/gameViewPatch.js";
import { generateBranchSequence } from "../../../frontend/src/features/multiplayer/games/timber/timberPrediction.js";
import { predictShot } from "../../../frontend/src/features/multiplayer/games/puncture/puncturePrediction.js";
const { values } = parseArgs({ options: { credentials: { type: "string", default: ".wrangler/local-staging-credentials.json" }, rooms: { type: "string", default: "100" }, seconds: { type: "string", default: "20" }, proxy: { type: "string" }, rtt: { type: "string", default: "40" }, jitter: { type: "string", default: "0" }, report: { type: "string", default: ".wrangler/load-report.json" } } });
const credentials = JSON.parse(await readFile(values.credentials!, "utf8"));
const roomCount = Math.min(1000, Math.max(1, Number(values.rooms))), seconds = Math.min(120, Math.max(1, Number(values.seconds)));
const rpc = async (endpoint: string, body: unknown) => {
  const response = await fetch(`${credentials.baseUrl}/__test/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${credentials.testSecret}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Staging ${endpoint}: ${response.status}`);
  return response.json() as Promise<any>;
};
const percentile = (samples: number[], part = .95) => { const sorted = samples.sort((a, b) => a - b); return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * part) - 1)] : null; };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const acks: number[] = [], updates: number[] = [], rtts: number[] = [], rejectedAges: number[] = [];
const rejections: Record<string, number> = {};
let accepted = 0, sent = 0, transportErrors = 0;
type PendingInput = { at: number; sequence: number; epoch: number; visibleAt?: number };
class Player {
  socket: WebSocket;
  snapshot: any;
  clock = createServerClock();
  sequence = 0;
  pongs = 0;
  lastActionAt = 0;
  pending = new Map<string, PendingInput>();
  acknowledged = new Map<string, PendingInput>();
  ready: Promise<void>;
  timers: Array<ReturnType<typeof setTimeout>> = [];
  lastDirection = "";
  predictedChops = 0;
  roundToken: string | undefined;
  constructor(public room: any, public identity: any, spectator = false) {
    const base = values.proxy || credentials.baseUrl;
    const url = new URL(`/parties/game/${room.roomId}`, base);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.search = new URLSearchParams({ userId: identity.userId, admission: identity.admission, protocolVersion: "4" }).toString();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Staging connection timed out")), 10_000);
      const check = () => { if(this.snapshot && this.clock.isSynchronized() && this.pongs >= 3) { clearTimeout(timeout); resolve(); } };
      this.socket.on("error", () => { transportErrors++; reject(new Error("WebSocket transport failed")); });
      this.socket.on("open", () => {
        const sample = () => {
          this.clock.beginSamplingWindow();
          for(const delay of [0, 100, 250]) this.timers.push(setTimeout(() => this.send("system.clockPing", { clientMonotonic: performance.now() }), delay));
        };
        sample(); this.timers.push(setTimeout(sample, 15_000));
      });
      this.socket.on("message", (wire) => {
        const m = JSON.parse(String(wire)), now = performance.now();
        if(m.type === "system.clockPong") {
          rtts.push(now - m.payload.clientMonotonic);
          this.pongs++;
          this.clock.recordPong(m.payload, now);
          this.send("system.rttReport", { rttMs: this.clock.getBestRtt(), jitterMs: this.clock.getJitter() });
          check(); return;
        }
        if(m.type === "game.actionResult" || m.type === "game.ack") {
          const pending = this.pending.get(m.id);
          if(pending) {
            acks.push(now - pending.at); this.pending.delete(m.id);
            if(m.payload.accepted !== false) {
              accepted++;
              if(pending.visibleAt != null) updates.push(pending.visibleAt - pending.at);
              else this.acknowledged.set(m.id, pending);
            }
            else { const reason = m.payload.reason || "unspecified"; rejections[reason] = (rejections[reason] || 0) + 1; if(reason === "invalid_time" && Number.isFinite(m.payload.timeErrorMs)) rejectedAges.push(m.payload.timeErrorMs); }
          }
          return;
        }
        if(m.type === "game.snapshot") this.snapshot = m.payload;
        if(m.type === "game.update" && this.snapshot) {
          if(m.revision !== this.snapshot.revision + 1) { this.send("game.resync", {}); return; }
          const p = m.payload ?? {};
          this.snapshot = { ...this.snapshot, revision: m.revision, room: applyRoomPatch(this.snapshot.room, p.room), players: this.snapshot.players.map((player: any) => ({ ...player, state: applyStatePatch(player.state, p.players?.[player.userId]) })), events: appendById(this.snapshot.events, p.events) };
        }
        if(this.snapshot) {
          const me = this.snapshot.players.find((p: any) => p.userId === identity.userId);
          if(me) {
            this.sequence = Math.max(this.sequence, Number(me.state.inputSequence) || 0);
            // A coalesced snapshot can beat its action result. Keep the first observed update
            // time so that ACK order does not turn feedback latency into an unrelated later patch.
            for(const action of this.pending.values()) if(action.visibleAt == null && action.epoch === this.snapshot.room.state.inputEpoch && Number(me.state.inputSequence) >= action.sequence) action.visibleAt = now;
            for(const [id, action] of this.acknowledged) if(action.epoch === this.snapshot.room.state.inputEpoch && Number(me.state.inputSequence) >= action.sequence) { updates.push(now - action.at); this.acknowledged.delete(id); }
          }
        }
        check();
      });
    });
    if(!spectator) this.ready.then(() => {
      const timer = setInterval(() => this.act(), 60);
      this.timers.push(timer);
    }).catch(() => {});
  }
  send(type: string, payload: any) {
    if(this.socket.readyState !== WebSocket.OPEN) return;
    const id = crypto.randomUUID(); this.socket.send(JSON.stringify({ id, type, payload })); return id;
  }
  act() {
    if(!this.snapshot || this.snapshot.room.status !== "active") return;
    const state = this.snapshot.room.state, me = this.snapshot.players.find((p: any) => p.userId === this.identity.userId)?.state;
    if(!me) return;
    const now = this.clock.now();
    let type: string, data: any;
    if(state.phase === "question_active" && now >= state.currentQuestionActiveAt && !me.answeredQuestionIds?.includes(state.currentQuestionId)) { type = "game.answer"; data = { submittedResponse: "A", questionId: state.currentQuestionId }; }
    else if(state.phase === "timber_active" && now >= (me.stunnedUntil || 0)) {
      if(this.roundToken !== state.roundToken) { this.roundToken = state.roundToken; this.predictedChops = me.timberActualChops || 0; }
      this.predictedChops = Math.max(this.predictedChops, me.timberActualChops || 0);
      const branch = generateBranchSequence(state.timberBranchSeed, this.predictedChops + 1)[this.predictedChops++];
      type = "game.chop"; data = { side: branch === "left" ? "right" : "left" };
    } else if(state.phase === "puncture_active" && now >= (me.stunnedUntil || 0)) {
      const prediction = predictShot({ shotAt: now, roundStartedAt: state.punctureRoundStartedAt, rotationTurnsPerSecond: state.rotationTurnsPerSecond, generatedPinAngles: state.generatedPinAngles, attachedPinAngles: me.puncturePinAngles });
      if(prediction.hit) return;
      type = "game.shoot"; data = { shotAt: now };
    } else if(state.phase === "flutter_active") {
      const target = state.visibleFlutterRings?.[0] ?? { x: 0, y: 0 };
      data = { left: me.flutterX > target.x + .2, right: me.flutterX < target.x - .2, up: me.flutterY < target.y - .2, down: me.flutterY > target.y + .2 };
      const direction = JSON.stringify(data); if(direction === this.lastDirection) return; this.lastDirection = direction;
      type = "game.flutterInput";
    } else return;
    if((type === "game.chop" || type === "game.shoot") && now - this.lastActionAt < 50) return;
    this.lastActionAt = now;
    const payload = { ...data, clientActionId: crypto.randomUUID(), sequence: ++this.sequence, occurredAt: now, inputEpoch: state.inputEpoch, roundToken: state.roundToken };
    const id = this.send(type, payload);
    if(id) { sent++; this.pending.set(id, { at: performance.now(), sequence: payload.sequence, epoch: payload.inputEpoch }); }
  }
  close() { this.timers.forEach(clearTimeout); this.socket.terminate(); }
}
const rooms: any[] = [], players: Player[] = [];
try {
  if(values.proxy) await fetch(new URL('/__network', values.proxy), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rttMs: Number(values.rtt), jitterMs: Number(values.jitter) }) });
  for(let first = 0; first < roomCount; first += 10) await Promise.all(Array.from({ length: Math.min(10, roomCount - first) }, async (_, offset) => {
    const index = first + offset;
    const room = await rpc("rooms", { modeId: ["sat-timber", "sat-puncture", "sat-flutter"][index % 3], bot: index % 10 === 0, spectators: index % 10 === 0 ? 2 : 0 }); rooms.push(room);
    const clients = [...room.players.map((p: any) => new Player(room, p)), ...room.spectators.map((p: any) => new Player(room, p, true))];
    players.push(...clients); await Promise.all(clients.map((p) => p.ready));
  }));
  console.info(`Exercising ${rooms.length} isolated rooms and ${players.length} connections for ${seconds}s.`);
  await sleep(seconds * 1000);
  const stats: any[] = [];
  for(let first = 0; first < rooms.length; first += 10) await Promise.all(rooms.slice(first, first + 10).map(async (room) => {
    await rpc("command", { roomId: room.roomId, command: "finish" });
    let data: any;
    for(let attempt = 0; attempt < 20; attempt++) { data = await rpc("command", { roomId: room.roomId, command: "stats" }); if(data.settled) break; await sleep(100); }
    stats.push(data);
  }));
  const processing = stats.flatMap((s) => s.samples.processingMs ?? []);
  const lateness = stats.flatMap((s) => s.samples.deadlineLatenessMs ?? []);
  const report = { generatedAt: new Date().toISOString(), environment: credentials.baseUrl, rooms: rooms.length, connections: players.length, completedMatches: stats.filter((s) => s.status === "finished" && s.settled).length, seconds,
    profile: values.proxy ? { rttMs: Number(values.rtt), jitterMs: Number(values.jitter) } : "direct-cloud-network", sent, accepted, rejections, transportErrors,
    invalidTimeAges: rejectedAges.length ? { min: Math.min(...rejectedAges), max: Math.max(...rejectedAges) } : null, p95RttMs: percentile(rtts), p95AckMs: percentile(acks), p95UpdateMs: percentile(updates), p95ProcessingMs: percentile(processing), p95DeadlineLatenessMs: percentile(lateness),
    alarmWrites: stats.reduce((sum, s) => sum + (s.counters['storage.alarm'] || 0), 0), checkpointWrites: stats.reduce((sum, s) => sum + (s.counters['storage.checkpoint'] || 0), 0) };
  await writeFile(values.report!, JSON.stringify(report, null, 2) + '\n'); console.info(JSON.stringify(report, null, 2));
  if(report.completedMatches !== rooms.length || transportErrors) process.exitCode = 1;
} finally {
  players.forEach((p) => p.close());
  await Promise.allSettled(rooms.map((room) => rpc("command", { roomId: room.roomId, command: "dispose" })));
}
