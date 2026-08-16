import { Server, type Connection, type ConnectionContext, type WSMessage } from "partyserver";
import { appendChatMessage, appendSystemChatMessage, type ChatMessage } from "../chat";
import { getGameMode } from "../games/registry";
import type { PlayerIdentity } from "../types";
import { makeId, parseMessage, requestRoom, send, stateFromRequest } from "../utils";

type PartyState = {
  id: string;
  leaderUserId: string;
  members: Array<PlayerIdentity & { joinedAt: number; ready: boolean; disconnectedAt?: number | null }>;
  modeId: string;
  joinCodeExpiresAt: number;
  expiresAt: number | null;
  pendingInvites: Array<{ userId: string; expiresAt: number }>;
  chat: ChatMessage[];
  launching?: boolean;
};

export class SocialPartyServer extends Server<Env> {
  static options = { hibernate: true };
  state: PartyState | null = null;

  async onStart() {
    this.state = (await this.ctx.storage.get<PartyState>("state")) ?? null;
    if (this.state) {
      if (!this.state.chat) this.state.chat = [];
      if (!this.state.pendingInvites) this.state.pendingInvites = [];
      if (this.state.launching == null) this.state.launching = false;
    }
  }

  async onConnect(connection: Connection, context: ConnectionContext) {
    const identity = stateFromRequest(context.request);
    const member = this.state?.members.find((entry) => entry.userId === identity.userId);
    if (!member) return connection.close(1008, "Not a party member");
    connection.setState(identity);
    Object.assign(member, identity, { disconnectedAt: null });
    await this.saveAndBroadcast();
  }

  async onMessage(connection: Connection, raw: WSMessage) {
    const message = parseMessage(raw);
    const identity = connection.state as PlayerIdentity;
    if (!message || !this.state || !this.state.members.some((member) => member.userId === identity.userId)) return;
    try {
      if (message.type === "party.selectMode") this.selectMode(identity.userId, String((message.payload as any)?.modeId));
      if (message.type === "party.ready") {
        this.ready(identity.userId, Boolean((message.payload as any)?.ready));
        if (this.canLaunch()) await this.launch();
      }
      if (message.type === "party.launch") await this.launch(identity.userId);
      if (message.type === "party.invite") await this.invite(identity, String((message.payload as any)?.userId));
      if (message.type === "chat.send") this.state.chat = appendChatMessage(this.state.chat, identity, message.payload as any);
      await this.saveAndBroadcast();
      await this.scheduleNextAlarm();
    } catch (error) {
      send(connection, "error", { message: error instanceof Error ? error.message : "Party request failed." }, message.id);
    }
  }

  async onRequest(request: Request) {
    const body = await request.json<any>();
    if (body.type === "party.hasMember") {
      return Response.json({ exists: Boolean(this.state?.members.some((member) => member.userId === body.userId)) });
    }
    if (body.type === "party.presence") {
      const member = this.state?.members.find((entry) => entry.userId === body.userId);
      if (member) member.disconnectedAt = body.connected ? null : Date.now();
      await this.saveAndBroadcast();
      await this.scheduleNextAlarm();
      return Response.json({ ok: true });
    }
    if (body.type === "party.initialize") {
      if (!this.state) {
        this.state = { id: this.name, leaderUserId: body.player.userId, members: [{ ...body.player, joinedAt: Date.now(), ready: false }], modeId: "sat-classic", joinCodeExpiresAt: Date.now() + 10 * 60_000, expiresAt: null, pendingInvites: [], chat: [], launching: false };
        this.state.chat = appendSystemChatMessage(this.state.chat, `${body.player.displayName} joined the party.`);
      }
    } else if (body.type === "party.inviteUser") {
      if (!this.state?.members.some((member) => member.userId === body.identity?.userId)) return new Response("Inviter is not in this party", { status: 403 });
      await this.invite(body.identity, String(body.targetUserId ?? ""));
    } else if (body.type === "party.join") {
      if (!this.state || !this.state.members.length || this.state.expiresAt) return Response.json({ joined: false });
      if (!this.state.members.some((member) => member.userId === body.player.userId) && Date.now() > this.state.joinCodeExpiresAt) return new Response("Party code expired", { status: 410 });
      if (this.state.members.length >= 8) return new Response("Party is full", { status: 409 });
      const existingMember = this.state.members.find((member) => member.userId === body.player.userId);
      if (existingMember) Object.assign(existingMember, body.player, { disconnectedAt: null });
      else {
        this.state.members.push({ ...body.player, joinedAt: Date.now(), ready: false });
        this.state.pendingInvites = this.state.pendingInvites.filter((invite) => invite.userId !== body.player.userId);
        this.state.chat = appendSystemChatMessage(this.state.chat, `${body.player.displayName} joined the party.`);
      }
      this.clearReady();
    } else if (body.type === "party.leave") {
      await this.removeMember(body.userId);
    }
    await this.saveAndBroadcast();
    await this.scheduleNextAlarm();
    return Response.json(body.type === "party.join" ? { joined: true } : (this.state ?? { ok: true }));
  }

  async onAlarm() {
    if (this.state) {
      const cutoff = Date.now() - 30_000;
      const expired = this.state.members.filter((member) => member.disconnectedAt && member.disconnectedAt <= cutoff);
      for (const member of expired) await this.removeMember(member.userId);
      const pendingInviteCount = this.state.pendingInvites.length;
      this.state.pendingInvites = this.state.pendingInvites.filter((invite) => invite.expiresAt > Date.now());
      const invitationsExpired = this.state.pendingInvites.length !== pendingInviteCount;
      if (expired.length || invitationsExpired) await this.saveAndBroadcast();
    }
    if (this.state?.members.length === 0 && this.state.expiresAt && Date.now() >= this.state.expiresAt) {
      await this.ctx.storage.deleteAll();
      this.state = null;
      return;
    }
    await this.scheduleNextAlarm();
  }

  private selectMode(userId: string, modeId: string) {
    if (this.state?.leaderUserId !== userId) throw new Error("Only the leader can select a mode.");
    if (!getGameMode(modeId)?.supportsPartyGames) throw new Error("This mode cannot be played in a party.");
    this.state.modeId = modeId;
    this.clearReady();
  }

  private ready(userId: string, ready: boolean) {
    if (!this.state) return;
    const mode = getGameMode(this.state.modeId);
    if (!mode || this.state.members.length > mode.playerCount) throw new Error("This party is over the selected mode's player limit.");
    const member = this.state.members.find((entry) => entry.userId === userId);
    if (member) member.ready = ready;
  }

  private canLaunch() {
    if (!this.state || this.state.launching) return false;
    const mode = getGameMode(this.state.modeId);
    return Boolean(mode?.supportsPartyGames
      && this.state.members.length === mode.playerCount
      && this.state.members.every((member) => member.ready));
  }

  private async launch(userId?: string) {
    if (!this.state || (userId && this.state.leaderUserId !== userId)) throw new Error("Only the leader can launch.");
    if (this.state.launching) return;
    const mode = getGameMode(this.state.modeId);
    if (!mode?.supportsPartyGames || this.state.members.length !== mode.playerCount || !this.state.members.every((member) => member.ready)) throw new Error("Every required player must be ready.");
    this.state.launching = true;
    await this.saveAndBroadcast();
    const gameId = crypto.randomUUID();
    try {
      const response = await requestRoom(this.env.GAME, gameId, { type: "game.initialize", modeId: mode.id, ranked: false, players: this.state.members });
      if (!response.ok) throw new Error(await response.text());
      await Promise.all(this.state.members.map((member) => requestRoom(this.env.USER, member.userId, { type: "game.assigned", gameId, modeId: mode.id })));
      this.clearReady();
      await this.saveAndBroadcast();
    } catch (error) {
      this.state.launching = false;
      await this.saveAndBroadcast();
      throw error;
    }
  }

  private async invite(identity: PlayerIdentity, targetUserId: string) {
    if (!this.state || !targetUserId) return;
    if (this.state.pendingInvites.some((invite) => invite.userId === targetUserId && invite.expiresAt > Date.now())) throw new Error("That player already has a pending party invitation.");
    this.state.joinCodeExpiresAt = Date.now() + 10 * 60_000;
    const response = await requestRoom(this.env.USER, targetUserId, { type: "party.invite", invitation: { partyId: this.name, fromUserId: identity.userId, fromName: identity.displayName, fromProfilePicture: identity.profilePicture } });
    if (!response.ok) throw new Error(await response.text());
    this.state.pendingInvites.push({ userId: targetUserId, expiresAt: Date.now() + 10_000 });
  }

  private async removeMember(userId: string) {
    if (!this.state) return;
    const leavingMember = this.state.members.find((member) => member.userId === userId);
    this.state.members = this.state.members.filter((member) => member.userId !== userId);
    if (leavingMember) this.state.chat = appendSystemChatMessage(this.state.chat, `${leavingMember.displayName} left the party.`);
    if (this.state.leaderUserId === userId) this.state.leaderUserId = [...this.state.members].sort((a, b) => a.joinedAt - b.joinedAt)[0]?.userId ?? "";
    this.clearReady();
    if (!this.state.members.length) {
      this.state.expiresAt = Date.now() + 15 * 60_000;
      await this.ctx.storage.setAlarm(this.state.expiresAt);
    }
  }

  private async scheduleNextAlarm() {
    if (!this.state) return;
    const deadlines = [
      this.state.expiresAt,
      ...this.state.pendingInvites.map((invite) => invite.expiresAt),
      ...this.state.members.map((member) => member.disconnectedAt ? member.disconnectedAt + 30_000 : null),
    ].filter((value): value is number => Boolean(value));
    if (deadlines.length) await this.ctx.storage.setAlarm(Math.min(...deadlines));
  }

  private clearReady() {
    if (!this.state) return;
    this.state.launching = false;
    this.state.members.forEach((member) => { member.ready = false; });
  }
  private emit(connection: Connection) { send(connection, "party.snapshot", this.state); }
  private async saveAndBroadcast() {
    if (this.state) await this.ctx.storage.put("state", this.state);
    this.broadcast(JSON.stringify({ id: makeId(), type: "party.snapshot", payload: this.state }));
  }
}

export default SocialPartyServer;
