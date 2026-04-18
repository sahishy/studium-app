const SAT_CLASSIC_INITIAL_HEALTH = 3000
const SAT_CLASSIC_MAX_QUESTIONS = 10

const getCurrentQuestionId = (gameState = {}) => (
    gameState?.currentQuestionId
    ?? gameState?.questionIds?.[Number(gameState?.questionIndex) || 0]
    ?? null
)

const getCurrentQuestion = (gameState = {}) => {
    const questionId = getCurrentQuestionId(gameState)
    return {
        questionId,
        question: gameState?.questionsById?.[questionId] ?? null,
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
    SAT_CLASSIC_INITIAL_HEALTH,
    SAT_CLASSIC_MAX_QUESTIONS,
    getCurrentQuestion,
    getMyPlayer,
    hasAnsweredQuestion,
    getHealthBoard,
}
