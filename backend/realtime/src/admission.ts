const encoder = new TextEncoder();
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const decode = (value: string) => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));
const key = (secret: string) => crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
export const issueAdmission = async (secret: string | undefined, userId: string, roomId: string, now = Date.now()) => {
  if (!secret) return null;
  const payload = encode(encoder.encode(JSON.stringify({ v: 1, aud: "studium-game", userId, roomId, expiresAt: now + 15 * 60_000 })));
  return `${payload}.${encode(new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(payload))))}`;
};
export const verifyAdmission = async (secret: string | undefined, token: string, userId: string, roomId: string, now = Date.now()) => {
  if (!secret || token.length > 2048) return false;
  try {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra || !await crypto.subtle.verify("HMAC", await key(secret), decode(signature), encoder.encode(payload))) return false;
    const claims = JSON.parse(new TextDecoder().decode(decode(payload)));
    return claims.v === 1 && claims.aud === "studium-game" && claims.userId === userId && claims.roomId === roomId
      && claims.expiresAt > now && claims.expiresAt <= now + 15 * 60_000;
  } catch { return false; }
};
