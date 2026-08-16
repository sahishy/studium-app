import type { PlayerIdentity } from "./types";
import { makeId } from "./utils";

export type ChatMessage = {
  uid: string;
  clientMessageId?: string;
  userId: string | null;
  senderName: string;
  text: string;
  createdAt: number;
  system?: boolean;
};

export const sanitizeChatText = (value: unknown) => String(value ?? "").trim().slice(0, 300);

export const appendChatMessage = (
  messages: ChatMessage[],
  identity: PlayerIdentity,
  payload: { text?: string; clientMessageId?: string },
) => {
  const text = sanitizeChatText(payload?.text);
  if (!text) return messages;
  if (payload.clientMessageId && messages.some((entry) => entry.clientMessageId === payload.clientMessageId)) return messages;
  return [...messages, {
    uid: makeId("chat"),
    clientMessageId: payload.clientMessageId,
    userId: identity.userId,
    senderName: identity.displayName,
    text,
    createdAt: Date.now(),
  }].slice(-100);
};

export const appendSystemChatMessage = (messages: ChatMessage[], text: string) => [
  ...messages,
  {
    uid: makeId("chat"),
    userId: null,
    senderName: "System",
    text,
    createdAt: Date.now(),
    system: true,
  },
].slice(-100);
