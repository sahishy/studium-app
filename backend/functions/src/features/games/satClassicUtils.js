const SAT_CLASSIC_INITIAL_HEALTH = 3000
const SAT_CLASSIC_MAX_QUESTIONS = 10
const OVERLAY_DURATION_MS = 3000
const SAT_CLASSIC_ROUND_DURATION_MS = 180000 + OVERLAY_DURATION_MS
const SAT_CLASSIC_POST_SUBMIT_GRACE_MS = 16000
const SAT_CLASSIC_MIN_TIME_MULTIPLIER = 0.35
const SAT_CLASSIC_TIME_SCALE_SEC = 8
const ANSWERED_FIRST_MULTIPLIER = 1.5

const ELO_K_FACTOR = 32
const PLACEMENT_MATCHES = 3
// The first placement opponent is pitched around low Silver, and each result moves the next one by
// a step. A brand new account is rated 0, so without an explicit ladder every placement bot would
// also be rated 0 and three matches would place everybody in the same spot.
const PLACEMENT_START_ELO = 350
const PLACEMENT_STEP = 120
const PLACEMENT_SPAN = 220
const PLACEMENT_MIN_ELO = 120
const PLACEMENT_MAX_ELO = 900

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0))

const clampPlacementElo = (value) => Math.min(
    PLACEMENT_MAX_ELO,
    Math.max(PLACEMENT_MIN_ELO, Math.round(Number(value) || 0)),
)

const expectedScore = (selfElo, opponentElo) => 1 / (
    1 + Math.pow(10, ((Number(opponentElo) || 0) - (Number(selfElo) || 0)) / 400)
)

// A short match moves a rating less than a long one: two rounds says far less about skill than
// ten, and without this an early finish would be the quickest way to climb.
const roundsConfidence = (roundsPlayed) => {
    const rounds = Math.max(0, Number(roundsPlayed) || 0)
    if(rounds <= 1) return 0.1
    if(rounds >= 6) return 1
    return 0.6 + (((rounds - 2) / 4) * 0.4)
}

// Standard Elo. The delta now depends on who you played: beating someone far above you is worth
// several times beating someone far below, and the ladder stops drifting upward for everyone the
// way a fixed win/loss band does.
const getRankedEloDelta = ({
    isWin = false,
    isLoss = false,
    roundsPlayed = 0,
    selfElo = 0,
    opponentElo = 0,
} = {}) => {
    if(!isWin && !isLoss) return 0

    const actual = isWin ? 1 : 0
    const raw = ELO_K_FACTOR * (actual - expectedScore(selfElo, opponentElo)) * roundsConfidence(roundsPlayed)
    const rounded = Math.round(raw)

    // A decided match never rounds to nothing, or beating a much weaker opponent would read on
    // the match screen as though the game had not counted at all.
    if(rounded === 0) return isWin ? 1 : -1

    return rounded
}

// Rating for the next placement opponent, derived from how the earlier placement matches went.
const placementLadderStep = (outcome) => {
    if(outcome === 'win') return PLACEMENT_STEP
    if(outcome === 'draw') return 0
    return -PLACEMENT_STEP
}

const placementOpponentElo = (placementLog = []) => (Array.isArray(placementLog) ? placementLog : [])
    .filter(Boolean)
    .reduce(
        (elo, entry) => clampPlacementElo(elo + placementLadderStep(entry?.outcome)),
        PLACEMENT_START_ELO,
    )

// Where a player lands after their placement matches. Anchored on the opponents they actually
// faced, then pushed up or down by how they did against them, so both who you played and how you
// played decide the result. Clamped well short of the top ranks: three matches is evidence for a
// starting point, not for mastery.
const computePlacementElo = (placementLog = []) => {
    const results = (Array.isArray(placementLog) ? placementLog : []).filter(Boolean)

    if(!results.length) return clampPlacementElo(PLACEMENT_START_ELO)

    const anchor = results.reduce((total, entry) => total + (Number(entry.opponentElo) || 0), 0) / results.length
    const winShare = results.reduce(
        (total, entry) => total + (entry.outcome === 'win' ? 1 : (entry.outcome === 'draw' ? 0.5 : 0)),
        0,
    ) / results.length
    const performanceShare = results.reduce((total, entry) => total + clamp01(entry.performance), 0) / results.length

    // 0.5 means "held your own" and leaves the anchor alone; 1 lifts a full span, 0 drops one.
    const combined = (winShare * 0.6) + (performanceShare * 0.4)

    return clampPlacementElo(anchor + ((combined - 0.5) * 2 * PLACEMENT_SPAN))
}

const isPlacementComplete = (placementGamesPlayed) => (
    Math.max(0, Math.floor(Number(placementGamesPlayed) || 0)) >= PLACEMENT_MATCHES
)

const SAT_CLASSIC_BASE_DAMAGE = {
    Easy: 800,
    Medium: 1000,
    Hard: 1400,
}

const getRoundDamageMultiplier = (questionIndex = 0) => {
    const safeRoundIndex = Math.max(0, Number(questionIndex) || 0)
    const multiplier = 1 + (safeRoundIndex * 0.1)
    return Number(multiplier.toFixed(1))
}

const getBaseDamageByDifficulty = (difficulty) => {
    const normalizedDifficulty = String(difficulty ?? '').trim().toLowerCase()
    if(normalizedDifficulty === 'easy') return SAT_CLASSIC_BASE_DAMAGE.Easy
    if(normalizedDifficulty === 'hard') return SAT_CLASSIC_BASE_DAMAGE.Hard
    return SAT_CLASSIC_BASE_DAMAGE.Medium
}

const getTimeMultiplier = ({ elapsedMs, minMultiplier = SAT_CLASSIC_MIN_TIME_MULTIPLIER, scaleSec = SAT_CLASSIC_TIME_SCALE_SEC }) => {
    const timeSec = Math.max(0, Number(elapsedMs) || 0) / 1000
    const raw = minMultiplier + ((1 - minMultiplier) / (1 + (timeSec / scaleSec)))
    return Math.max(minMultiplier, Math.min(1, raw))
}

const calculateDamage = ({ baseDamage, elapsedMs, roundMultiplier = 1 }) => {
    const timeMultiplier = getTimeMultiplier({ elapsedMs })
    const safeRoundMultiplier = Number(roundMultiplier) || 1

    return {
        timeMultiplier,
        damage: Math.round((Number(baseDamage) || 0) * timeMultiplier * safeRoundMultiplier),
    }
}

const deriveWinnerFromHealth = (healthEntries = []) => {
    if(!healthEntries.length) {
        return null
    }

    const sortedHealth = [...healthEntries].sort((a, b) => b.health - a.health)
    if(sortedHealth.length < 2 || sortedHealth[0].health > sortedHealth[1].health) {
        return sortedHealth[0].userId
    }

    return null
}

const normalizeSprComparableValue = (value) => String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')

const evaluateQuestionAnswer = ({ question = {}, submittedResponse }) => {
    const questionType = String(question?.questionType ?? '').toLowerCase()
    const normalizedSubmittedResponse = String(submittedResponse ?? '').trim()

    if(questionType === 'spr') {
        const comparableSubmitted = normalizeSprComparableValue(normalizedSubmittedResponse)
        if(!comparableSubmitted) {
            return { isCorrect: false }
        }

        const comparableAcceptableAnswers = Array.isArray(question?.acceptableAnswersComparable)
            ? question.acceptableAnswersComparable
            : (Array.isArray(question?.acceptableAnswers)
                ? question.acceptableAnswers.map(normalizeSprComparableValue)
                : [])

        return {
            isCorrect: comparableAcceptableAnswers.includes(comparableSubmitted),
        }
    }

    const normalizedChoiceId = normalizedSubmittedResponse.toUpperCase()

    return {
        isCorrect: normalizedChoiceId === question?.correctAnswer,
    }
}

const buildPlayerStateMap = ({ playerIds = [], playerSnaps = [] }) => {

    const playerStateMap = {}

    playerSnaps.forEach((playerSnap, index) => {
        const playerId = playerIds[index]
        playerStateMap[playerId] = playerSnap.exists ? (playerSnap.data()?.state ?? {}) : {}
    })

    return playerStateMap

}

const buildUserStatsByUserId = ({ playerIds = [], userStatsSnaps = [] }) => {

    const userStatsByUserId = {}

    userStatsSnaps.forEach((userStatsSnap, index) => {
        const playerId = playerIds[index]
        userStatsByUserId[playerId] = userStatsSnap.exists ? (userStatsSnap.data() ?? {}) : {}
    })

    return userStatsByUserId

}

const resolveRoundAnswers = ({
    playerIds = [],
    playerStateMap = {},
    questionId,
    correctAnswer,
    roundMultiplier = 1,
}) => {
    const roundResultsByUserId = {}

    playerIds.forEach((playerId) => {
        const playerState = playerStateMap[playerId] ?? {}
        const lastAnswer = playerState?.lastAnswer ?? {}
        const answeredThisQuestion = lastAnswer?.questionId === questionId
        const selectedChoiceId = answeredThisQuestion ? (lastAnswer?.selectedChoiceId ?? null) : null
        const submittedResponse = answeredThisQuestion ? (lastAnswer?.submittedResponse ?? null) : null
        const isCorrect = answeredThisQuestion
            ? (typeof lastAnswer?.isCorrect === 'boolean' ? lastAnswer.isCorrect : selectedChoiceId === correctAnswer)
            : false
        const elapsedMs = Math.max(0, Number(lastAnswer?.elapsedMs) || 0)
        const baseDamage = isCorrect ? getBaseDamageByDifficulty(lastAnswer?.difficulty) : 0
        const { damage, timeMultiplier } = calculateDamage({ baseDamage, elapsedMs, roundMultiplier })

        roundResultsByUserId[playerId] = {
            userId: playerId,
            selectedChoiceId,
            submittedResponse,
            isCorrect,
            elapsedMs,
            elapsedSec: elapsedMs / 1000,
            baseDamage,
            roundMultiplier,
            timeMultiplier,
            answeredFirstMultiplier: 1,
            damageRaw: isCorrect ? damage : 0,
            damageDealt: 0,
            targetUserId: null,
        }
    })

    return roundResultsByUserId
}

const resolveRoundDamageOutcome = ({
    playerIds = [],
    playerStateMap = {},
    roundResultsByUserId = {},
    initialHealth = SAT_CLASSIC_INITIAL_HEALTH,
}) => {

    const healthBeforeByUserId = Object.fromEntries(playerIds.map((playerId) => ([
        playerId,
        Number(playerStateMap[playerId]?.health) || initialHealth,
    ])))
    const nextHealthByUserId = { ...healthBeforeByUserId }

    const [firstUserId, secondUserId] = playerIds
    const firstRawDamage = Number(roundResultsByUserId[firstUserId]?.damageRaw) || 0
    const secondRawDamage = Number(roundResultsByUserId[secondUserId]?.damageRaw) || 0

    const sourceUserId = firstRawDamage > secondRawDamage ? firstUserId : secondUserId
    const targetUserId = sourceUserId === firstUserId ? secondUserId : firstUserId

    const sourceRawDamage = Math.max(firstRawDamage, secondRawDamage)
    const targetRawDamage = Math.min(firstRawDamage, secondRawDamage)
    const netDamage = Math.max(0, sourceRawDamage - targetRawDamage)

    const damageTransfer = {
        bothCorrect: firstRawDamage > 0 && secondRawDamage > 0,
        isTie: firstRawDamage === secondRawDamage,
        sourceUserId: netDamage > 0
            ? sourceUserId
            : (firstRawDamage === secondRawDamage ? firstUserId : null),
        targetUserId: netDamage > 0
            ? targetUserId
            : (firstRawDamage === secondRawDamage ? secondUserId : null),
        sourceRawDamage,
        targetRawDamage,
        netDamage,
    }

    if(netDamage > 0 && targetUserId) {
        nextHealthByUserId[targetUserId] = Math.max(
            0,
            (nextHealthByUserId[targetUserId] ?? initialHealth) - netDamage,
        )

        roundResultsByUserId[sourceUserId] = {
            ...roundResultsByUserId[sourceUserId],
            damageDealt: netDamage,
            targetUserId,
        }
    }

    return {
        nextHealthByUserId,
        damageTransfer,
        roundResultsByUserId,
    }

}

export {
    SAT_CLASSIC_INITIAL_HEALTH,
    SAT_CLASSIC_MAX_QUESTIONS,
    SAT_CLASSIC_ROUND_DURATION_MS,
    SAT_CLASSIC_POST_SUBMIT_GRACE_MS,
    ANSWERED_FIRST_MULTIPLIER,
    ELO_K_FACTOR,
    PLACEMENT_MATCHES,
    PLACEMENT_MAX_ELO,
    PLACEMENT_MIN_ELO,
    PLACEMENT_START_ELO,
    computePlacementElo,
    expectedScore,
    isPlacementComplete,
    placementOpponentElo,
    roundsConfidence,
    getRankedEloDelta,
    getRoundDamageMultiplier,
    getBaseDamageByDifficulty,
    calculateDamage,
    deriveWinnerFromHealth,
    normalizeSprComparableValue,
    evaluateQuestionAnswer,
    buildPlayerStateMap,
    buildUserStatsByUserId,
    resolveRoundAnswers,
    resolveRoundDamageOutcome,
}