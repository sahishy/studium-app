import { ingressRegion, isNetworkRegion, type NetworkRegion } from "./network";
import { verifyAdmission } from "./admission";
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
    title: state?.title ?? null,
    level: state?.level ?? 1,
    eloByMode: state?.eloByMode ?? {},
    placementByMode: state?.placementByMode ?? {},
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
    title: url.searchParams.get("title") || null,
    level: Math.max(1, Number(url.searchParams.get("level")) || 1),
    eloByMode: parseJson(url.searchParams.get("eloByMode"), {}),
    placementByMode: parseJson(url.searchParams.get("placementByMode"), {}),
  };

  const parts = url.pathname.split("/").filter(Boolean);
  const roomId = parts[2] || "";
  const admissionOnly = parts[1] === "game" && await verifyAdmission(env.GAME_ADMISSION_SECRET, url.searchParams.get("admission") || "", userId, roomId);
  if (env.STAGING_TEST_ENABLED === "1" && !admissionOnly) return new Response("Unauthorized", { status: 401 });
  if (env.BACKEND_API_BASE_URL && !admissionOnly) {
    if (!token) return new Response("Unauthorized", { status: 401 });
    const response = await fetch(`${env.BACKEND_API_BASE_URL}/realtime/auth/verify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000),
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
  headers.set("X-Admission-Only", admissionOnly ? "1" : "0");
  headers.set("X-Network-Region", ingressRegion(request));
  headers.set("X-User-Id", identity.userId);
  headers.set("X-Display-Name", encodeURIComponent(identity.displayName));
  headers.set("X-Profile-Picture", encodeURIComponent(JSON.stringify(identity.profilePicture ?? null)));
  headers.set("X-Avatar", encodeURIComponent(JSON.stringify(identity.avatar ?? null)));
  headers.set("X-Title", encodeURIComponent(JSON.stringify(identity.title ?? null)));
  headers.set("X-Level", String(identity.level ?? 1));
  headers.set("X-Elo-By-Mode", encodeURIComponent(JSON.stringify(identity.eloByMode ?? {})));
  headers.set("X-Placement-By-Mode", encodeURIComponent(JSON.stringify(identity.placementByMode ?? {})));
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
  title: parseJson(decodeURIComponent(request.headers.get("X-Title") || "null"), null),
  level: Math.max(1, Number(request.headers.get("X-Level")) || 1),
  eloByMode: parseJson(decodeURIComponent(request.headers.get("X-Elo-By-Mode") || "{}"), {}),
  placementByMode: parseJson(decodeURIComponent(request.headers.get("X-Placement-By-Mode") || "{}"), {}),
  networkRegion: isNetworkRegion(request.headers.get("X-Network-Region")) ? request.headers.get("X-Network-Region") as NetworkRegion : undefined,
  admissionOnly: request.headers.get("X-Admission-Only") === "1",
  connectedAt: Date.now(),
  protocolVersion: Math.max(1, Number(new URL(request.url).searchParams.get("protocolVersion")) || 1),
});

export const requestRoom = <T extends Server<Env>>(
  namespace: DurableObjectNamespace<T>,
  roomId: string,
  body: unknown,
  locationHint?: NetworkRegion,
  timeoutMs = 10_000,
) => namespace.get(namespace.idFromName(roomId), locationHint ? { locationHint } : undefined).fetch(new Request(`https://internal.invalid/${encodeURIComponent(roomId)}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(timeoutMs),
}));

export type PublicActivity =
  | { state: "online" }
  | { state: "in_party"; modeId: string; partyPlayerCount: number }
  | { state: "in_game"; modeId: string; roomId: string };

let activitySecretWarningLogged = false;

export const publishActivities = async (env: Env, updates: Array<{ userId: string; activity: PublicActivity }>) => {
  if (!updates.length) return true;
  if (!env.BACKEND_API_BASE_URL) {
    console.error("Unable to publish player activity: BACKEND_API_BASE_URL is not configured.", { count: updates.length });
    return false;
  }
  if (!env.REALTIME_ACTIVITY_SECRET) {
    if (!activitySecretWarningLogged) {
      console.error("Unable to publish player activity: REALTIME_ACTIVITY_SECRET is not configured.");
      activitySecretWarningLogged = true;
    }
    return false;
  }
  try {
    const response = await fetch(`${env.BACKEND_API_BASE_URL.replace(/\/$/, "")}/realtime/activity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.REALTIME_ACTIVITY_SECRET}`,
      },
      body: JSON.stringify({ updates }),
      signal: AbortSignal.timeout(5_000),
    });
    if (response.ok) return true;

    const detail = (await response.text()).slice(0, 500);
    console.error("Unable to publish player activity.", { status: response.status, count: updates.length, detail });
    return false;
  } catch (error) {
    console.error("Unable to publish player activity.", {
      count: updates.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};
