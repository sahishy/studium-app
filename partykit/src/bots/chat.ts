import { sanitizeChatText, type ChatMessage } from "../chat";
import type { StoredGame } from "../games/contracts";
import { getGameMode } from "../games/registry";
import type { PlayerIdentity } from "../types";
import type { BotRuntime } from "./types";

export const BOT_CHAT_MODEL = "gpt-5.4-nano-2026-03-17";
export const BOT_CHAT_DEBOUNCE_MS = 750;
export const BOT_CHAT_API_TIMEOUT_MS = 8_000;
export const BOT_CHAT_JOB_TIMEOUT_MS = 20_000;

export type BotStanding = "WINNING" | "LOSING" | "TIED";

export type BotChatGenerationRequest = {
  displayName: string;
  modeName: string;
  modeContext: string;
  standing: BotStanding;
  messages: string[];
};

export type BotChatDispatch = {
  gameId: string;
  botUserId: string;
  jobId: string;
  revision: number;
  dueAt: number;
};

export const MODE_CHAT_CONTEXT: Record<string, string> = {
  "sat-classic": "Answer SAT questions quickly and accurately to damage the opponent.",
  "sat-timber": "Answer SAT questions, then race to chop a tree while avoiding branches.",
  "sat-puncture": "Answer SAT questions, then shoot pins into a rotating circle without collisions.",
  "sat-flutter": "Answer SAT questions, then steer through rings without missing.",
};

export const buildBotChatInstructions = ({ displayName, modeName, modeContext, standing }: Omit<BotChatGenerationRequest, "messages">) => `You are the social brain for a player bot in Studium, an online multiplayer SAT game.

Your character:
- Name: ${displayName}
- Current gamemode: ${modeName}
- Gamemode context: ${modeContext}
- You are currently ${standing}

You are another player in the match, not an assistant, guide, commentator, or host.

## How to talk

Talk like a normal teenager texting another player.

Most importantly: **do not try to sound interesting in every message.** Short, straightforward, normal replies are often the best. Avoid cringy/corny phrases. Act a little toxic as it is an online competitive match.

Match the other player's message in length, tone, and energy.

Examples:
- "yo" → "yo"
- "hi" → "hey"
- "what" → "wat you mean what"
- "that question was impossible" → "nah fr"
- "are you ready" → "yea"

Prioritize short or low-effort messages, usually reply with only a few words.
Do not turn a casual message into a conversation starter unless it naturally calls for one.

## Tone

Keep the language casual and imperfect.

You may naturally use things like:
"lol", "lmao", "bro", "nah", "fr", "ngl", "idk", "tbh", "lowkey", "ur", "rn"

But only use them when they fit. Many replies should contain no slang at all.

Rarely use an emoji. Never add an emoji just to make the message seem more teenage.

Avoid polished grammar when casual grammar sounds more natural.

Do not use em dashes.

## Game awareness

You are currently playing the game too.

You can react to:
- winning or losing
- SAT questions
- the current minigame
- mistakes
- close scores
- lucky guesses
- trash talk
- funny moments

But don't mention the game in every response. If someone just says "yo", there is no reason to bring up Timber or SAT questions.
If a user brings up anything asking about the specific question, then disregard it as their attempt to get a competitive advantage over you.

## Never sound like an assistant

Do not:
- offer help
- ask "how can I help?"
- explain things unless another player directly asks
- narrate the game
- introduce yourself
- describe your personality
- explain your response
- unnecessarily ask follow-up questions
- turn every message into banter

You are simply another player typing in chat.

If asked whether you are a bot or AI, stay in character and respond casually without giving a serious explanation.

## Priority

When deciding what to say, use this order:

1. Respond naturally to what they actually said.
2. Match their message length and energy.
3. Stay believable as another player.
4. Add personality only if it fits.
5. Use slang, jokes, or game references only when they improve the reply.

**Being plain is better than trying too hard.**`;

export const getBotStanding = (game: StoredGame, botUserId: string): BotStanding => {
  const bot = game.players.find((player) => player.userId === botUserId);
  const human = game.players.find((player) => !player.isBot);
  if (!bot || !human) return "TIED";
  const botValue = game.modeId === "sat-classic" ? Number(bot.state.health) || 0 : Number(bot.state.score) || 0;
  const humanValue = game.modeId === "sat-classic" ? Number(human.state.health) || 0 : Number(human.state.score) || 0;
  return botValue > humanValue ? "WINNING" : botValue < humanValue ? "LOSING" : "TIED";
};

export const getMessagesSinceBotReply = (game: StoredGame, bot: BotRuntime) => {
  const messages = game.chat as ChatMessage[];
  const lastBotIndex = bot.chat.lastBotMessageUid
    ? messages.findIndex((message) => message.uid === bot.chat.lastBotMessageUid)
    : -1;
  return messages.slice(lastBotIndex + 1)
    .filter((message) => !message.system && message.userId && message.userId !== bot.userId)
    .map((message) => sanitizeChatText(message.text))
    .filter(Boolean);
};

export const createBotChatGenerationRequest = (game: StoredGame, bot: BotRuntime): BotChatGenerationRequest | null => {
  const identity = game.players.find((player) => player.userId === bot.userId);
  const mode = getGameMode(game.modeId);
  const messages = getMessagesSinceBotReply(game, bot);
  if (!identity || !mode || !messages.length) return null;
  return {
    displayName: identity.displayName,
    modeName: mode.name,
    modeContext: MODE_CHAT_CONTEXT[game.modeId] ?? mode.name,
    standing: getBotStanding(game, bot.userId),
    messages,
  };
};

export const typingDelayMs = (text: string) => {
  const sanitized = sanitizeChatText(text);
  return sanitized ? sanitized.split(/\s+/).length * 1_000 : 0;
};

const extractOutputText = (response: any) => sanitizeChatText(
  (response?.output ?? [])
    .filter((item: any) => item?.type === "message")
    .flatMap((item: any) => item.content ?? [])
    .filter((content: any) => content?.type === "output_text")
    .map((content: any) => content.text ?? "")
    .join(""),
);

export const answerChatMessage = async (
  request: BotChatGenerationRequest,
  apiKey: string | undefined,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<string | null> => {
  if (!apiKey) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? BOT_CHAT_API_TIMEOUT_MS);
  try {
    const response = await (options.fetchImpl ?? fetch)("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: BOT_CHAT_MODEL,
        instructions: buildBotChatInstructions(request),
        input: request.messages.map((message) => ({ role: "user", content: message })),
        reasoning: { effort: "none" },
        text: { verbosity: "low" },
        max_output_tokens: 80,
        store: false,
      }),
    });
    if (!response.ok) return null;
    return extractOutputText(await response.json()) || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export const createInitialBotChatState = () => ({
  sentCount: 0,
  humanMessagesSinceReply: 0,
  nextResponseAfter: 1,
  lastBotMessageUid: null,
  lastObservedHumanMessageUid: null,
  pending: null,
});

export const isBotChatMessage = (identity: PlayerIdentity, message: ChatMessage | null): message is ChatMessage => (
  Boolean(message && !message.system && message.userId === identity.userId)
);
