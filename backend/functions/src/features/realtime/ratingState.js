import { PLACEMENT_MATCHES, computePlacementElo, getRankedEloDelta, isPlacementComplete } from '../games/satClassicUtils.js'

// One is a participation floor while placing, not a provisional skill rating.
export const getModeElo = (stats = {}) => {
    const hasPlayed = Number(stats.gamesPlayed) > 0 || Number(stats.placementGamesPlayed) > 0 || stats.placed
    if(!stats.placed) return hasPlayed ? 1 : 0
    return Math.max(1, Number(stats.elo) || 0)
}

export const buildRankedResult = ({ current = {}, outcome, opponentElo, performance = 0.5 }) => {
    const gamesPlayed = (Number(current.gamesPlayed) || 0) + 1
    if(!current.placed) {
        const placementLog = [
            ...(Array.isArray(current.placementLog) ? current.placementLog : []),
            { outcome, opponentElo, performance },
        ].slice(-PLACEMENT_MATCHES)
        const placementGamesPlayed = Math.max(0, Number(current.placementGamesPlayed) || 0) + 1
        const placed = isPlacementComplete(placementGamesPlayed)
        const elo = placed ? computePlacementElo(placementLog) : 1
        return {
            nextModeStats: { ...current, gamesPlayed, placementGamesPlayed, placementLog, placed, elo, peakElo: elo },
            eloDelta: 0,
            placement: {
                gamesPlayed: placementGamesPlayed,
                required: PLACEMENT_MATCHES,
                remaining: Math.max(0, PLACEMENT_MATCHES - placementGamesPlayed),
                placed,
                ...(placed ? { elo } : {}),
            },
        }
    }
    const selfElo = getModeElo(current)
    const delta = getRankedEloDelta({ isWin: outcome === 'win', isLoss: outcome === 'loss', selfElo, opponentElo })
    const elo = Math.max(1, selfElo + delta)
    return {
        nextModeStats: { ...current, gamesPlayed, elo, peakElo: Math.max(Number(current.peakElo) || 0, elo) },
        eloDelta: elo - selfElo,
    }
}
