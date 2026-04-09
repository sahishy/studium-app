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
    { minElo: 0, tierName: 'Bronze', tier: 'I' },
]

const rankedIconModules = import.meta.glob('../assets/images/ranked/*.svg', {
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

const getRankInfoFromElo = (elo = 0) => {
    const safeElo = Number.isFinite(Number(elo)) ? Math.max(0, Number(elo)) : 0
    const matched = RANK_TIERS.find((entry) => safeElo >= entry.minElo)

    if(!matched) {
        return {
            tierName: 'Unranked',
            tier: null,
            imageSrc: rankedIconMap.unranked,
        }
    }

    const tierNameKey = matched.tierName.toLowerCase()
    const iconKey = matched.tier ? `${tierNameKey}_${matched.tier}` : tierNameKey

    return {
        tierName: matched.tierName,
        tier: matched.tier,
        imageSrc: rankedIconMap[iconKey] ?? rankedIconMap.unranked,
    }
}

const getRankedModeStats = (userStats, modeId) => {
    const modeStats = userStats?.ranked?.[modeId]

    return {
        elo: modeStats?.elo ?? 0,
        peakElo: modeStats?.peakElo ?? 0,
        gamesPlayed: modeStats?.gamesPlayed ?? 0,
    }
}

export {
    RANK_TIERS,
    getRankInfoFromElo,
    getRankedModeStats,
}
