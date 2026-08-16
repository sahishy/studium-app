import { FaBoltLightning, FaFeatherPointed, FaMapPin, FaTree } from 'react-icons/fa6'
import { RANK_TIERS, getRankInfoFromElo, getModeStats } from '../../profile/utils/statsUtils'
import { RiSwordFill } from 'react-icons/ri'

const DEFAULT_MODE_ID = 'sat-classic'
const MATCH_JOIN_DELAY_SECONDS = 3

const GAME_MODES = [
    {
        id: 'sat-classic',
        name: 'Classic',
        type: 'multiplayer',
        playerCount: 2,
        ranked: true,
        supportsPublicMatchmaking: true,
        supportsPartyGames: true,
        icon: RiSwordFill,
        description: 'Compete head-to-head in SAT battles and outscore your opponent across timed rounds.',
    },
    {
        id: 'sat-timber',
        name: 'Timber',
        type: 'multiplayer',
        playerCount: 2,
        ranked: true,
        supportsPublicMatchmaking: true,
        supportsPartyGames: true,
        icon: FaTree,
        description: 'Earn an edge with SAT questions, then race your opponent to chop through the Timber rounds.',
    },
    {
        id: 'sat-puncture',
        name: 'Puncture',
        type: 'multiplayer',
        playerCount: 2,
        ranked: true,
        supportsPublicMatchmaking: true,
        supportsPartyGames: true,
        icon: FaMapPin,
        description: 'Win SAT advantages, then time your shots to clear every pin without striking another.',
    },
    {
        id: 'sat-flutter',
        name: 'Flutter',
        type: 'multiplayer',
        playerCount: 2,
        ranked: true,
        supportsPublicMatchmaking: true,
        supportsPartyGames: true,
        icon: FaFeatherPointed,
        description: 'Earn a shield with SAT questions, then fly together through an endless accelerating ring course.',
    },
    {
        id: 'blitz',
        name: 'Blitz',
        type: 'singleplayer',
        playerCount: 1,
        ranked: false,
        supportsPublicMatchmaking: false,
        supportsPartyGames: false,
        icon: FaBoltLightning,
        description: 'Answer 10 questions as fast possible, requiring quick thinking and accuracy under pressure.',
    },
]

const getModeById = (modeId = DEFAULT_MODE_ID) => {
    return GAME_MODES.find((mode) => mode.id === modeId) ?? GAME_MODES[0]
}

const getCombinedRankedElo = (userStats) => {
    return GAME_MODES
        .filter((mode) => mode.ranked)
        .reduce((total, mode) => total + (Number(userStats?.play?.[mode.id]?.elo) || 0), 0)
}

const getQueueState = (session) => (
    session?.status === 'in_room'
        ? 'matched'
        : (session?.status === 'queue' ? 'queueing' : 'idle')
)

const getQueueTimeSeconds = ({ matchmaking, isQueueing, nowMs }) => {
    const queuedAtMs = matchmaking?.queuedAt?.toDate
        ? matchmaking.queuedAt.toDate().getTime()
        : (matchmaking?.queuedAt instanceof Date
            ? matchmaking.queuedAt.getTime()
            : Number(matchmaking?.queuedAt) || null)

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

const getGameTeamId = (player) => player?.teamId ?? player?.team?.id ?? player?.state?.teamId ?? null

const areGameTeammates = (firstPlayer, secondPlayer) => {
    const firstTeamId = getGameTeamId(firstPlayer)
    const secondTeamId = getGameTeamId(secondPlayer)
    if(firstTeamId != null && secondTeamId != null) return String(firstTeamId) === String(secondTeamId)

    const firstUserId = firstPlayer?.userId ?? firstPlayer?.uid ?? null
    const secondUserId = secondPlayer?.userId ?? secondPlayer?.uid ?? null
    return firstUserId != null && secondUserId != null && String(firstUserId) === String(secondUserId)
}

const buildMultiplayerUiState = ({ userStats, modeId = DEFAULT_MODE_ID }) => {
    const mode = getModeById(modeId)
    const rankedStats = getModeStats(userStats, mode)
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

    const isFinalRank = rankInfo.tierName === 'Grandmaster';
    const rankLabel = isFinalRank ? rankInfo.tierName : `${rankInfo.tierName} ${rankInfo.tier}`;
    const nextTierLabel = nextTierThreshold
        ? `${nextTierThreshold.tierName} ${nextTierThreshold.tier}`
        : 'Global Ranking: #?'

    return {
        mode,
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

const buildSingleplayerUiState = ({ userStats, modeId = DEFAULT_MODE_ID }) => {
    const mode = getModeById(modeId)
    const singleplayerStats = getModeStats(userStats, mode)

    return {
        mode,
        singleplayerStats,
    }
}

export {
    DEFAULT_MODE_ID,
    MATCH_JOIN_DELAY_SECONDS,
    GAME_MODES,
    getModeById,
    getCombinedRankedElo,
    getQueueState,
    getQueueTimeSeconds,
    formatQueueTimeLabel,
    areGameTeammates,
    buildMultiplayerUiState,
    buildSingleplayerUiState,
}
