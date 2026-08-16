import type { GameModeDefinition } from "./contracts";
import { createSatClassicGame } from "./sat-classic";
import { createBlitzGame } from "./blitz";
import { createTimberGame } from "./timber";
import { createPunctureGame } from "./puncture";
import { createFlutterGame } from "./flutter";

export const GAME_MODES: Record<string, GameModeDefinition> = {
  "sat-classic": {
    id: "sat-classic", name: "Classic", playerCount: 2, ranked: true,
    supportsPublicMatchmaking: true, supportsPartyGames: true, createGame: createSatClassicGame,
  },
  "sat-timber": {
    id: "sat-timber", name: "Timber", playerCount: 2, ranked: true,
    supportsPublicMatchmaking: true, supportsPartyGames: true, createGame: createTimberGame,
  },
  "sat-puncture": {
    id: "sat-puncture", name: "Puncture", playerCount: 2, ranked: true,
    supportsPublicMatchmaking: true, supportsPartyGames: true, createGame: createPunctureGame,
  },
  "sat-flutter": {
    id: "sat-flutter", name: "Flutter", playerCount: 2, ranked: true,
    supportsPublicMatchmaking: true, supportsPartyGames: true, createGame: createFlutterGame,
  },
  blitz: {
    id: "blitz", name: "Blitz", playerCount: 1, ranked: false,
    supportsPublicMatchmaking: false, supportsPartyGames: false, createGame: createBlitzGame,
  },
};

export const getGameMode = (modeId: string) => GAME_MODES[modeId] ?? null;
