import { getQuestionById } from '../../../services/questionService'

const getRoundDamageMultiplier = (questionIndex = 0) => {
    const safeRoundIndex = Math.max(0, Number(questionIndex) || 0)
    const multiplier = 1 + (safeRoundIndex * 0.1)
    return Number(multiplier.toFixed(1))
}

const getCurrentQuestionId = (gameState = {}) => (
    gameState?.currentQuestionId
    ?? gameState?.questionIds?.[Number(gameState?.questionIndex) || 0]
    ?? null
)

const getCurrentQuestion = (gameState = {}) => {
    const questionId = getCurrentQuestionId(gameState)
    return {
        questionId,
        question: getQuestionById(questionId),
    }
}

const getMyPlayer = ({ players = [], userId }) => (
    players.find((entry) => entry.userId === userId) ?? null
)

const hasAnsweredQuestion = ({ player, questionId }) => (
    (player?.state?.answeredQuestionIds ?? []).includes(questionId)
)

const mapHealthPlayer = (entry = {}) => ({
    userId: entry?.userId ?? null,
    name: entry?.displayName ?? '',
    health: Number(entry?.state?.health) || 0,
    profilePicture: entry?.profilePicture ?? null,
})

const getHealthBoard = ({ players = [], userId }) => {
    const leftEntry = players.find((entry) => entry.userId === userId) ?? null
    const rightEntry = players.find((entry) => entry.userId !== userId) ?? null

    return {
        leftPlayer: mapHealthPlayer(leftEntry),
        rightPlayer: mapHealthPlayer(rightEntry),
    }
}

export {
    getCurrentQuestion,
    getRoundDamageMultiplier,
    getMyPlayer,
    hasAnsweredQuestion,
    getHealthBoard,
}
