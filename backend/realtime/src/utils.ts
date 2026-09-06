import type { Connection, Server, WSMessage } from "partyserver";
import type { ConnectionState, PlayerIdentity, RealtimeMessage } from "./types";

export const makeId = (prefix = "msg") => `${prefix}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

export const parseMessage = (value: WSMessage): RealtimeMessage | null => {
  try {
    const bytes = ArrayBuffer.isView(value)
      ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      : value;
    const parsed = JSON.parse(typeof bytes === "string" ? bytes : new TextDecoder().decode(bytes));
    return parsed && typeof parsed.id === "string" && typeof parsed.type === "string" ? parsed : null;
  } catch {
    return null;
  }
};

export const send = (connection: Connection, type: string, payload?: unknown, id = makeId()) => {
  connection.send(JSON.stringify({ id, type, payload } satisfies RealtimeMessage));
};

export const connectionIdentity = (connection: Connection): PlayerIdentity => {
  const state = connection.state as ConnectionState | null;
  return {
    userId: state?.userId || connection.id,
    displayName: state?.displayName || "Player",
    profilePicture: state?.profilePicture ?? null,
    avatar: state?.avatar ?? null,
    eloByMode: state?.eloByMode ?? {},
  };
};

export const verifyConnection = async (request: Request, env: Env) => {
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

  const headers = new Headers(request.headers);
  headers.set("X-User-Id", identity.userId);
  headers.set("X-Display-Name", encodeURIComponent(identity.displayName));
  headers.set("X-Profile-Picture", encodeURIComponent(JSON.stringify(identity.profilePicture ?? null)));
  headers.set("X-Avatar", encodeURIComponent(JSON.stringify(identity.avatar ?? null)));
  headers.set("X-Elo-By-Mode", encodeURIComponent(JSON.stringify(identity.eloByMode ?? {})));
  return new Request(request, { headers });
};

const parseJson = <T>(value: string | null, fallback: T): T => {
  try { return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
};

export const stateFromRequest = (request: Request): ConnectionState => ({
  userId: request.headers.get("X-User-Id") || "",
  displayName: decodeURIComponent(request.headers.get("X-Display-Name") || "Player"),
  profilePicture: (() => {
    try { return JSON.parse(decodeURIComponent(request.headers.get("X-Profile-Picture") || "null")); }
    catch { return null; }
  })(),
  avatar: parseJson(decodeURIComponent(request.headers.get("X-Avatar") || "null"), null),
  eloByMode: parseJson(decodeURIComponent(request.headers.get("X-Elo-By-Mode") || "{}"), {}),
  connectedAt: Date.now(),
  protocolVersion: Math.max(1, Number(new URL(request.url).searchParams.get("protocolVersion")) || 1),
});

export const requestRoom = <T extends Server<Env>>(
  namespace: DurableObjectNamespace<T>,
  roomId: string,
  body: unknown,
) => namespace.getByName(roomId).fetch(new Request(`https://internal.invalid/${encodeURIComponent(roomId)}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
}));

export type PublicActivity =
  | { state: "online" }
  | { state: "in_party"; modeId: string; partyPlayerCount: number }
  | { state: "in_game"; modeId: string };

let activitySecretWarningLogged = false;

export const publishActivities = async (env: Env, updates: Array<{ userId: string; activity: PublicActivity }>) => {
  if (!updates.length || !env.BACKEND_API_BASE_URL) return;
  if (!env.REALTIME_ACTIVITY_SECRET) {
    if (!activitySecretWarningLogged) {
      console.warn("Player activity is disabled: REALTIME_ACTIVITY_SECRET is not configured.");
      activitySecretWarningLogged = true;
    }
    return;
  }
  const response = await fetch(`${env.BACKEND_API_BASE_URL}/realtime/activity`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.REALTIME_ACTIVITY_SECRET}`,
    },
    body: JSON.stringify({ updates }),
  });
  if (!response.ok) console.warn("Unable to publish player activity.", { status: response.status, count: updates.length });
};
