import { FaBoltLightning } from 'react-icons/fa6'
import { RANK_TIERS, getRankInfoFromElo, getModeStats } from '../../profile/utils/statsUtils'
import { RiSwordFill } from 'react-icons/ri'

const ROOMS_COLLECTION = 'multiplayerRooms'
const MATCHMAKING_COLLECTION = 'multiplayerMatchmaking'
const PLAY_SESSIONS_COLLECTION = 'playSessions'
const DEFAULT_MODE_ID = 'sat-classic'
const MATCH_JOIN_DELAY_SECONDS = 3

const GAME_MODES = [
    {
        id: 'sat-classic',
        name: 'SAT Classic',
        type: 'multiplayer',
        icon: RiSwordFill,
        description: 'Compete head-to-head in SAT battles and outscore your opponent across timed rounds.',
    },
    {
        id: 'blitz',
        name: 'Blitz',
        type: 'singleplayer',
        icon: FaBoltLightning,
        description: 'Answer 10 questions as fast possible, requiring quick thinking and accuracy under pressure.',
        scoreLabel: 'Fastest Time',
    },
]

const getModeById = (modeId = DEFAULT_MODE_ID) => {
    return GAME_MODES.find((mode) => mode.id === modeId) ?? GAME_MODES[0]
}

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
    ROOMS_COLLECTION,
    MATCHMAKING_COLLECTION,
    PLAY_SESSIONS_COLLECTION,
    DEFAULT_MODE_ID,
    MATCH_JOIN_DELAY_SECONDS,
    GAME_MODES,
    getModeById,
    getQueueState,
    getQueueTimeSeconds,
    formatQueueTimeLabel,
    buildMultiplayerUiState,
    buildSingleplayerUiState,
}
