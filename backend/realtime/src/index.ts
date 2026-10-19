import { stagingRequest } from "./staging";
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
    const staging = await stagingRequest(request, env);
    if (staging) return staging;
    if (request.method === "GET" && url.pathname === "/health") {
      const activityPublishingConfigured = Boolean(env.BACKEND_API_BASE_URL && env.REALTIME_ACTIVITY_SECRET);
      return Response.json({
        ok: activityPublishingConfigured || env.STAGING_TEST_ENABLED === "1",
        service: "studium-realtime",
        activityPublishingConfigured,
      }, { status: activityPublishingConfigured || env.STAGING_TEST_ENABLED === "1" ? 200 : 503 });
    }

    const response = await routePartykitRequest(request, env, {
      onBeforeConnect: (upgradeRequest) => verifyConnection(upgradeRequest, env),
      onBeforeRequest: () => new Response("Not found", { status: 404 }),
    });
    return response ?? new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
