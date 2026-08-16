# Studium realtime service

This package owns transient multiplayer state: user sessions, parties, per-mode queues, live games, deadlines, reconnect grace periods, and match chat. Firebase remains the permanent source of authentication, questions, profiles, ratings, statistics, and completed results.

## Environment

Set this PartyKit environment variable in production:

- `BACKEND_API_BASE_URL`: the deployed backend origin.
- `OPENAI_API_KEY`: a server-only OpenAI API key used by isolated bot-chat rooms.
- `PARTYKIT_HOST`: the public PartyKit host used by alarm callbacks, such as `localhost:1999` locally or the same deployed host configured as `VITE_PARTYKIT_HOST` in the frontend.

Set `VITE_PARTYKIT_HOST` for the frontend to the deployed PartyKit host. Local development defaults to `localhost:1999`.

For local browser testing, create `partykit/.env` with `BACKEND_API_BASE_URL` pointing to the local Firebase Functions API and `OPENAI_API_KEY` set if bot chat should respond. `PARTYKIT_HOST` defaults to `localhost:1999`; set it explicitly when using another port. PartyKit must be able to reach the backend so game rooms can load questions. A missing OpenAI key disables AI replies without affecting gameplay.

## Commands

- `npm run dev`: run PartyKit locally.
- `npm run check`: type-check the service.
- `npm run simulate:matchmaking`: exercise the shared matcher with two-player, four-player, and mixed-size entries.

The registry in `src/games/registry.ts` is the entry point for new modes. A mode supplies its player count and capabilities plus a game engine; the shared matchmaker does not contain mode-specific branches.
