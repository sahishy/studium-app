import type * as Party from "partykit/server";
import type { ConnectionState, PartyEnv, PlayerIdentity, RealtimeMessage } from "./types";

export const makeId = (prefix = "msg") => `${prefix}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

export const partyRoomUrl = (env: PartyEnv, party: string, roomId: string) => {
  const configured = String(env.PARTYKIT_HOST || "localhost:1999").trim().replace(/\/+$/, "");
  const withProtocol = /^https?:\/\//i.test(configured)
    ? configured
    : /^wss?:\/\//i.test(configured)
      ? configured.replace(/^ws/i, "http")
      : `${/^(localhost|127(?:\.\d+){3}|\[::1\])(?::|$)/i.test(configured) ? "http" : "https"}://${configured}`;
  return `${withProtocol}/parties/${encodeURIComponent(party)}/${encodeURIComponent(roomId)}`;
};

export const parseMessage = (value: string | ArrayBuffer): RealtimeMessage | null => {
  try {
    const parsed = JSON.parse(typeof value === "string" ? value : new TextDecoder().decode(value));
    return parsed && typeof parsed.id === "string" && typeof parsed.type === "string" ? parsed : null;
  } catch {
    return null;
  }
};

export const send = (connection: Party.Connection, type: string, payload?: unknown, id = makeId()) => {
  connection.send(JSON.stringify({ id, type, payload } satisfies RealtimeMessage));
};

export const broadcast = (room: Party.Room, type: string, payload?: unknown) => {
  room.broadcast(JSON.stringify({ id: makeId(), type, payload } satisfies RealtimeMessage));
};

export const connectionIdentity = (connection: Party.Connection): PlayerIdentity => {
  const state = connection.state as ConnectionState | null;
  return {
    userId: state?.userId || connection.id,
    displayName: state?.displayName || "Player",
    profilePicture: state?.profilePicture ?? null,
    avatar: state?.avatar ?? null,
    eloByMode: state?.eloByMode ?? {},
  };
};

export const verifyConnection = async (request: Party.Request, env: PartyEnv) => {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") || "";
  const token = url.searchParams.get("token") || "";
  let identity: PlayerIdentity = {
    userId,
    displayName: url.searchParams.get("displayName") || "Player",
    profilePicture: parseJson(url.searchParams.get("profilePicture"), null),
    avatar: parseJson(url.searchParams.get("avatar"), null),
    eloByMode: parseJson(url.searchParams.get("eloByMode"), {}),
  };

  if (env.BACKEND_API_BASE_URL) {
    if (!token) return new Response("Unauthorized", { status: 401 });
    const response = await fetch(`${env.BACKEND_API_BASE_URL}/realtime/auth/verify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      console.warn("Realtime authentication verification failed.", { status: response.status, detail });
      return new Response("Unauthorized", { status: 401 });
    }
    identity = await response.json() as PlayerIdentity;
  } else if (!userId) {
    return new Response("Missing user", { status: 401 });
  }

  request.headers.set("X-User-Id", identity.userId);
  request.headers.set("X-Display-Name", encodeURIComponent(identity.displayName));
  request.headers.set("X-Profile-Picture", encodeURIComponent(JSON.stringify(identity.profilePicture ?? null)));
  request.headers.set("X-Avatar", encodeURIComponent(JSON.stringify(identity.avatar ?? null)));
  request.headers.set("X-Elo-By-Mode", encodeURIComponent(JSON.stringify(identity.eloByMode ?? {})));
  return request;
};

const parseJson = <T>(value: string | null, fallback: T): T => {
  try { return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
};

export const stateFromRequest = (request: Party.Request): ConnectionState => ({
  userId: request.headers.get("X-User-Id") || "",
  displayName: decodeURIComponent(request.headers.get("X-Display-Name") || "Player"),
  profilePicture: (() => {
    try { return JSON.parse(decodeURIComponent(request.headers.get("X-Profile-Picture") || "null")); }
    catch { return null; }
  })(),
  avatar: parseJson(decodeURIComponent(request.headers.get("X-Avatar") || "null"), null),
  eloByMode: parseJson(decodeURIComponent(request.headers.get("X-Elo-By-Mode") || "{}"), {}),
  connectedAt: Date.now(),
});
