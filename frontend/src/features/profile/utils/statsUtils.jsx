const RANK_TIERS = [
    { minElo: 1600, tierName: 'Grandmaster', tier: 'I' },
    { minElo: 1550, tierName: 'Master', tier: 'IV' },
    { minElo: 1500, tierName: 'Master', tier: 'III' },
    { minElo: 1450, tierName: 'Master', tier: 'II' },
    { minElo: 1400, tierName: 'Master', tier: 'I' },
    { minElo: 1350, tierName: 'Elite', tier: 'IV' },
    { minElo: 1300, tierName: 'Elite', tier: 'III' },
    { minElo: 1250, tierName: 'Elite', tier: 'II' },
    { minElo: 1200, tierName: 'Elite', tier: 'I' },
    { minElo: 1080, tierName: 'Platinum', tier: 'IV' },
    { minElo: 1020, tierName: 'Platinum', tier: 'III' },
    { minElo: 960, tierName: 'Platinum', tier: 'II' },
    { minElo: 900, tierName: 'Platinum', tier: 'I' },
    { minElo: 780, tierName: 'Gold', tier: 'IV' },
    { minElo: 720, tierName: 'Gold', tier: 'III' },
    { minElo: 660, tierName: 'Gold', tier: 'II' },
    { minElo: 600, tierName: 'Gold', tier: 'I' },
    { minElo: 480, tierName: 'Silver', tier: 'IV' },
    { minElo: 420, tierName: 'Silver', tier: 'III' },
    { minElo: 360, tierName: 'Silver', tier: 'II' },
    { minElo: 300, tierName: 'Silver', tier: 'I' },
    { minElo: 180, tierName: 'Bronze', tier: 'IV' },
    { minElo: 120, tierName: 'Bronze', tier: 'III' },
    { minElo: 60, tierName: 'Bronze', tier: 'II' },
    { minElo: 1, tierName: 'Bronze', tier: 'I' },
]

const rankedIconModules = import.meta.glob('../../../assets/images/ranked/*.svg', {
    eager: true,
    import: 'default',
})

const rankedIconMap = Object.entries(rankedIconModules).reduce((acc, [path, src]) => {

    const fileName = path.split('/').pop()?.replace('.svg', '')
    if(fileName) {
        acc[fileName] = src
    }
    return acc

}, {})

const UNRANKED_INFO = {
    tierName: 'Unranked',
    tier: null,
    placed: false,
    get imageSrc() { return rankedIconMap.unranked },
}

// Placement status remains Unranked even after the participation floor is set.
const getRankInfoFromElo = (elo = 0, { placed = true } = {}) => {

    if(!placed) return { ...UNRANKED_INFO, imageSrc: rankedIconMap.unranked }

    const safeElo = Number.isFinite(Number(elo)) ? Math.max(0, Number(elo)) : 0
    const matched = RANK_TIERS.find((entry) => safeElo >= entry.minElo)

    if(!matched) {
        return {
            tierName: 'Unranked',
            tier: null,
            placed: false,
            imageSrc: rankedIconMap.unranked,
        }
    }

    const tierNameKey = matched.tierName.toLowerCase()
    const iconKey = matched.tier ? `${tierNameKey}_${matched.tier}` : tierNameKey

    return {
        tierName: matched.tierName,
        tier: matched.tier,
        placed: true,
        imageSrc: rankedIconMap[iconKey] ?? rankedIconMap.unranked,
    }

}

const PLACEMENT_MATCHES = 3

// Placement state for one mode. Mirrors the backend's per-mode record, and treats anything it has
// not seen as "still placing" so a new account is never shown a rating it has not earned.
const getPlacementState = (userStats, modeId) => {
    const modeStats = userStats?.play?.[modeId] ?? {}
    const gamesPlayed = Math.max(0, Number(modeStats.placementGamesPlayed) || 0)

    return {
        placed: Boolean(modeStats.placed),
        gamesPlayed,
        required: PLACEMENT_MATCHES,
        remaining: Math.max(0, PLACEMENT_MATCHES - gamesPlayed),
    }
}

const isModePlaced = (userStats, modeId) => getPlacementState(userStats, modeId).placed

const getModeStats = (userStats, mode) => {
    const modeStats = userStats?.play?.[mode?.id] ?? {}

    if(mode?.type === 'singleplayer') {
        return {
            peakScore: modeStats?.peakScore ?? 0,
            gamesPlayed: modeStats?.gamesPlayed ?? 0,
        }
    }

    return {
        elo: modeStats.placed
            ? Math.max(1, Number(modeStats.elo) || 0)
            : (Number(modeStats.gamesPlayed) > 0 || Number(modeStats.placementGamesPlayed) > 0 ? 1 : 0),
        peakElo: modeStats.placed ? Math.max(1, Number(modeStats.peakElo) || 0, Number(modeStats.elo) || 0) : 0,
        gamesPlayed: modeStats?.gamesPlayed ?? 0,
        placed: Boolean(modeStats?.placed),
        placementGamesPlayed: Math.max(0, Number(modeStats?.placementGamesPlayed) || 0),
    }
}

const getTotalElo = (userStats) => {
    
    const rankedStats = userStats?.play

    if(!rankedStats) {
        return 0
    }

    return Object.keys(rankedStats).reduce((total, modeId) => {
        if(modeId === 'blitz') return total
        return total + getModeStats(userStats, { id: modeId, type: 'multiplayer' }).elo
    }, 0)

}

export {
    PLACEMENT_MATCHES,
    RANK_TIERS,
    getPlacementState,
    getRankInfoFromElo,
    getModeStats,
    getTotalElo,
    isModePlaced,
}
