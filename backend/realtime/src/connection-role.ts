import type { StoredGame } from './games/contracts'
import type { ConnectionRole } from './types'

export const getGameConnectionRole = (game: StoredGame, userId: string): ConnectionRole | null => {
  if (game.players.some((entry) => entry.userId === userId)) return 'player'
  return game.players.length >= 2 ? 'spectator' : null
}

const SPECTATOR_MESSAGE_TYPES = new Set([
  'game.subscribe',
  'game.resync',
  'system.clockPing',
  'system.rttReport',
  'system.metricsReport',
  'chat.send',
  'game.chat',
])

export const canSpectatorSendMessage = (type: string) => SPECTATOR_MESSAGE_TYPES.has(type)
