import { RANK_TIERS, getRankInfoFromElo, getRankedModeStats } from '../../profile/utils/statsUtils'

const DEFAULT_MODE_ID = 'sat_1v1'
const MATCH_JOIN_DELAY_SECONDS = 3

const getQueueState = (session) => (
    session?.status === 'in_room'
        ? 'matched'
        : (session?.status === 'queue' ? 'queueing' : 'idle')
)

const getQueueTimeSeconds = ({ matchmaking, isQueueing, nowMs }) => {
    const queuedAtMs = matchmaking?.queuedAt?.toDate
        ? matchmaking.queuedAt.toDate().getTime()
        : null

    if(!queuedAtMs || !isQueueing) {
        return 0
    }

    return Math.max(0, Math.floor((nowMs - queuedAtMs) / 1000))
}

const formatQueueTimeLabel = (queueTimeSeconds = 0) => {
    const minutes = Math.floor(queueTimeSeconds / 60)
    const seconds = queueTimeSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const buildRankedUiState = ({ userStats, modeId = DEFAULT_MODE_ID }) => {
    const rankedStats = getRankedModeStats(userStats, modeId)
    const rankInfo = getRankInfoFromElo(rankedStats.elo)

    const currentTierThreshold = RANK_TIERS.find((entry) => (
        entry.tierName === rankInfo.tierName
        && entry.tier === rankInfo.tier
    )) ?? RANK_TIERS[RANK_TIERS.length - 1]

    const ascendingTiers = [...RANK_TIERS].sort((a, b) => a.minElo - b.minElo)
    const nextTierThreshold = ascendingTiers.find((entry) => entry.minElo > rankedStats.elo)

    const currentTierMinElo = currentTierThreshold.minElo
    const nextTierMinElo = nextTierThreshold?.minElo ?? (currentTierMinElo + 100)
    const currentTierSpan = Math.max(1, nextTierMinElo - currentTierMinElo)
    const currentTierProgress = Math.max(0, rankedStats.elo - currentTierMinElo)
    const eloToNextTier = Math.max(0, nextTierMinElo - rankedStats.elo)

    const rankLabel = rankInfo.tier ? `${rankInfo.tierName} ${rankInfo.tier}` : rankInfo.tierName
    const nextTierLabel = nextTierThreshold
        ? `${nextTierThreshold.tierName} ${nextTierThreshold.tier}`
        : 'Max tier reached'

    return {
        rankedStats,
        rankInfo,
        currentTierMinElo,
        currentTierSpan,
        currentTierProgress,
        eloToNextTier,
        rankLabel,
        nextTierLabel,
        nextTierThreshold,
    }
}

export {
    DEFAULT_MODE_ID,
    MATCH_JOIN_DELAY_SECONDS,
    getQueueState,
    getQueueTimeSeconds,
    formatQueueTimeLabel,
    buildRankedUiState,
}
