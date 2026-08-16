import { Server, type Connection, type ConnectionContext, type WSMessage } from "partyserver";
import { getGameMode } from "../games/registry";
import type { PlayerIdentity, QueueEntry } from "../types";
import { makeId, parseMessage, requestRoom, send, stateFromRequest } from "../utils";

type UserState = {
  userId: string;
  status: "idle" | "queue" | "in_room";
  modeId: string | null;
  currentRoomId: string | null;
  queuedAt: number | null;
  partyId: string | null;
  invitations: Array<{ partyId: string; fromUserId: string; fromName: string; fromProfilePicture?: unknown; expiresAt: number }>;
};

const initialState = (userId: string): UserState => ({
  userId, status: "idle", modeId: null, currentRoomId: null, queuedAt: null, partyId: null, invitations: [],
});

export class UserServer extends Server<Env> {
  static options = { hibernate: true };
  state!: UserState;

  async onStart() {
    this.state = (await this.ctx.storage.get<UserState>("state")) ?? initialState(this.name);
    this.pruneInvitations();
  }

  async onConnect(connection: Connection, context: ConnectionContext) {
    const identity = stateFromRequest(context.request);
    if (identity.userId !== this.name) return connection.close(1008, "Invalid user room");
    connection.setState(identity);
    await this.reconcileCurrentRoom();
    if (this.state.partyId) {
      const response = await requestRoom(this.env.PARTY, this.state.partyId, { type: "party.hasMember", userId: this.name });
      const membership = response.ok ? await response.json() as { exists?: boolean } : { exists: false };
      if (!membership.exists) {
        this.state.partyId = null;
        await this.ctx.storage.put("state", this.state);
      } else {
        await requestRoom(this.env.PARTY, this.state.partyId, { type: "party.presence", userId: this.name, connected: true });
      }
    }
    this.emit(connection);
  }

  async onClose(connection: Connection) {
    const identity = connection.state as PlayerIdentity;
    if (!identity?.userId || !this.state.partyId) return;
    const stillConnected = [...this.getConnections<PlayerIdentity>()].some((candidate) => candidate.state?.userId === identity.userId);
    if (!stillConnected) {
      await requestRoom(this.env.PARTY, this.state.partyId, { type: "party.presence", userId: identity.userId, connected: false });
    }
  }

  async onMessage(connection: Connection, raw: WSMessage) {
    const message = parseMessage(raw);
    if (!message) return send(connection, "error", { message: "Invalid message." });
    const identity = connection.state as PlayerIdentity;
    try {
      if (message.type === "session.subscribe") return this.emit(connection, message.id);
      if (message.type === "queue.join") await this.joinQueue(identity, message.payload as any);
      if (message.type === "queue.leave") await this.leaveQueue();
      if (message.type === "game.startSolo") await this.startSolo(identity, message.payload as any);
      if (message.type === "party.createAndInvite") await this.createPartyAndInvite(identity, String((message.payload as any)?.userId ?? ""));
      if (message.type === "party.join") await this.joinParty(identity, String((message.payload as any)?.partyId ?? ""), Boolean((message.payload as any)?.quietly));
      if (message.type === "party.leave") await this.leaveParty(identity);
      if (message.type === "party.invite.dismiss") this.dismissInvitation(message.payload as any);
      await this.saveAndBroadcast();
    } catch (error) {
      send(connection, "error", { message: error instanceof Error ? error.message : "Request failed." }, message.id);
    }
  }

  async onRequest(request: Request) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const body = await request.json<any>();
    if (body.type === "game.assigned") {
      this.state.status = "in_room";
      this.state.modeId = body.modeId;
      this.state.currentRoomId = body.gameId;
      this.state.queuedAt = null;
    } else if (body.type === "game.finished") {
      if (this.state.currentRoomId === body.gameId) {
        this.state.status = "idle";
        this.state.modeId = null;
        this.state.currentRoomId = null;
        this.state.queuedAt = null;
      }
    } else if (body.type === "party.joined") {
      this.state.partyId = body.partyId;
    } else if (body.type === "party.left") {
      if (this.state.partyId === body.partyId) this.state.partyId = null;
    } else if (body.type === "party.invite") {
      this.state.invitations = this.state.invitations.filter((invite) => (
        invite.partyId !== body.invitation.partyId || invite.fromUserId !== body.invitation.fromUserId
      ));
      this.state.invitations.push({ ...body.invitation, expiresAt: Date.now() + 10_000 });
      this.pruneInvitations();
    }
    await this.saveAndBroadcast();
    return Response.json(this.state);
  }

  private emit(connection: Connection, id = makeId()) {
    this.pruneInvitations();
    send(connection, "session.snapshot", this.state, id);
  }

  private async saveAndBroadcast() {
    await this.ctx.storage.put("state", this.state);
    this.broadcast(JSON.stringify({ id: makeId(), type: "session.snapshot", payload: this.state }));
  }

  private async reconcileCurrentRoom() {
    if (this.state.status !== "in_room" || !this.state.currentRoomId) return;
    const response = await requestRoom(this.env.GAME, this.state.currentRoomId, { type: "game.sessionStatus" });
    if (response.ok) {
      const game = await response.json() as { status?: string; playerIds?: string[] };
      const playerIsInGame = Array.isArray(game.playerIds) && game.playerIds.includes(this.name);
      if (game.status === "active" && playerIsInGame) return;
    }
    this.state.status = "idle";
    this.state.modeId = null;
    this.state.currentRoomId = null;
    this.state.queuedAt = null;
    await this.ctx.storage.put("state", this.state);
  }

  private pruneInvitations() {
    this.state.invitations = this.state.invitations.filter((invite) => invite.expiresAt > Date.now());
  }

  private dismissInvitation(payload: { partyId?: string; fromUserId?: string }) {
    this.state.invitations = this.state.invitations.filter((invite) => (
      invite.partyId !== payload?.partyId || invite.fromUserId !== payload?.fromUserId
    ));
  }

  private async joinQueue(identity: PlayerIdentity, payload: { modeId: string; elo?: number }) {
    if (this.state.partyId) throw new Error("Leave your party before joining public matchmaking.");
    if (this.state.status !== "idle") throw new Error("You are already queued or in a game.");
    const mode = getGameMode(payload.modeId);
    if (!mode?.supportsPublicMatchmaking) throw new Error("This mode does not support public matchmaking.");
    const entry: QueueEntry = {
      id: this.name,
      userIds: [this.name],
      players: [{ ...identity, elo: Number(payload.elo) || 0 }],
      averageElo: Number(payload.elo) || 0,
      joinedAt: Date.now(),
    };
    const response = await requestRoom(this.env.MATCHMAKER, payload.modeId, { type: "queue.join", entry, requesterUserId: this.name });
    if (!response.ok) throw new Error(await response.text());
    const assignment = await response.json() as { gameId?: string };
    if (assignment.gameId) {
      this.state.status = "in_room";
      this.state.modeId = payload.modeId;
      this.state.currentRoomId = assignment.gameId;
      this.state.queuedAt = null;
    } else {
      this.state.status = "queue";
      this.state.modeId = payload.modeId;
      this.state.queuedAt = entry.joinedAt;
    }
  }

  private async leaveQueue() {
    if (this.state.status !== "queue" || !this.state.modeId) return;
    await requestRoom(this.env.MATCHMAKER, this.state.modeId, { type: "queue.leave", entryId: this.name });
    this.state.status = "idle";
    this.state.modeId = null;
    this.state.queuedAt = null;
  }

  private async startSolo(identity: PlayerIdentity, payload: { modeId: string }) {
    if (this.state.partyId) throw new Error("Leave your party before starting a solo game.");
    const mode = getGameMode(payload.modeId);
    if (!mode || mode.playerCount !== 1) throw new Error("This is not a solo mode.");
    const gameId = crypto.randomUUID();
    const response = await requestRoom(this.env.GAME, gameId, { type: "game.initialize", modeId: mode.id, ranked: false, players: [identity] });
    if (!response.ok) throw new Error(await response.text());
    this.state.status = "in_room";
    this.state.modeId = mode.id;
    this.state.currentRoomId = gameId;
    this.state.queuedAt = null;
  }

  private async createParty(identity: PlayerIdentity) {
    if (this.state.partyId) throw new Error("You are already in a party.");
    const partyId = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
    const response = await requestRoom(this.env.PARTY, partyId, { type: "party.initialize", player: identity });
    if (!response.ok) throw new Error(await response.text());
    this.state.partyId = partyId;
  }

  private async createPartyAndInvite(identity: PlayerIdentity, targetUserId: string) {
    if (!targetUserId) throw new Error("Choose a player to invite.");
    await this.createParty(identity);
    const response = await requestRoom(this.env.PARTY, this.state.partyId!, { type: "party.inviteUser", identity, targetUserId });
    if (!response.ok) throw new Error(await response.text());
  }

  private async joinParty(identity: PlayerIdentity, partyId: string, quietly = false) {
    if (!partyId) throw new Error("Enter a party code.");
    if (this.state.partyId) throw new Error("Leave your current party first.");
    const response = await requestRoom(this.env.PARTY, partyId.toUpperCase(), { type: "party.join", player: identity });
    if (!response.ok) {
      if (quietly) return;
      throw new Error(await response.text());
    }
    const result = await response.json() as { joined?: boolean };
    if (!result.joined) {
      if (quietly) return;
      throw new Error("That party is no longer available.");
    }
    this.state.partyId = partyId.toUpperCase();
    this.state.invitations = this.state.invitations.filter((invite) => invite.partyId !== this.state.partyId);
  }

  private async leaveParty(identity: PlayerIdentity) {
    if (!this.state.partyId) return;
    const partyId = this.state.partyId;
    await requestRoom(this.env.PARTY, partyId, { type: "party.leave", userId: identity.userId });
    this.state.partyId = null;
  }
}

export default UserServer;
