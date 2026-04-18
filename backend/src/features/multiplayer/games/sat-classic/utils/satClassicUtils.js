const SAT_CLASSIC_INITIAL_HEALTH = 3000
const SAT_CLASSIC_MAX_QUESTIONS = 10
const SAT_CLASSIC_MIN_TIME_MULTIPLIER = 0.35
const SAT_CLASSIC_TIME_SCALE_SEC = 8
const ANSWERED_FIRST_MULTIPLIER = 1.5
const SAT_CLASSIC_WIN_ELO_DELTA = 20
const SAT_CLASSIC_LOSS_ELO_DELTA = -20

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
        const isCorrect = answeredThisQuestion ? selectedChoiceId === correctAnswer : false
        const elapsedMs = Math.max(0, Number(lastAnswer?.elapsedMs) || 0)
        const baseDamage = isCorrect ? getBaseDamageByDifficulty(lastAnswer?.difficulty) : 0
        const { damage, timeMultiplier } = calculateDamage({ baseDamage, elapsedMs, roundMultiplier })

        roundResultsByUserId[playerId] = {
            userId: playerId,
            selectedChoiceId,
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

export {
    SAT_CLASSIC_INITIAL_HEALTH,
    SAT_CLASSIC_MAX_QUESTIONS,
    ANSWERED_FIRST_MULTIPLIER,
    SAT_CLASSIC_WIN_ELO_DELTA,
    SAT_CLASSIC_LOSS_ELO_DELTA,
    getRoundDamageMultiplier,
    getBaseDamageByDifficulty,
    calculateDamage,
    deriveWinnerFromHealth,
    resolveRoundAnswers,
}
