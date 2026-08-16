import { routePartykitRequest } from "partyserver";
import { verifyConnection } from "./utils";

export { UserServer } from "./servers/user";
export { SocialPartyServer } from "./servers/party";
export { MatchmakerServer } from "./servers/matchmaker";
export { GameServer } from "./servers/game";
export { BotChatServer } from "./servers/bot-chat";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "studium-realtime" });
    }

    const response = await routePartykitRequest(request, env, {
      onBeforeConnect: (upgradeRequest) => verifyConnection(upgradeRequest, env),
      onBeforeRequest: () => new Response("Not found", { status: 404 }),
    });
    return response ?? new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
