const QUESTION_EVENT_TYPES = new Set(['ROUND_RESOLVED', 'QUESTION_RESOLVED'])
const getRoundResults = (event) => Array.isArray(event?.data?.roundResults) ? event.data.roundResults : []
const getWinnerUserIds = (event) => {
    if(QUESTION_EVENT_TYPES.has(event?.type)) return getRoundResults(event).filter((entry) => entry?.isCorrect).map((entry) => entry.userId)
    if(Array.isArray(event?.data?.winnerUserIds)) return event.data.winnerUserIds
    return [event?.data?.winnerUserId].filter(Boolean)
}

const buildMinigameRound = ({ event, modeId, userId, opponentUserId }) => {
    const roundNumber = Math.max(1, (Number(event?.data?.roundIndex) || 0) + 1)
    if(modeId === 'sat-timber') return {
        id: event.uid, kind: 'minigame', title: `Timber Round ${roundNumber}`,
        summary: `${Number(event?.data?.progressByUserId?.[userId]) || 0}–${Number(event?.data?.progressByUserId?.[opponentUserId]) || 0} chops`,
        winnerUserIds: getWinnerUserIds(event),
    }
    if(modeId === 'sat-puncture') return {
        id: event.uid, kind: 'minigame', title: `Puncture Round ${roundNumber}`,
        summary: `${Number(event?.data?.remainingByUserId?.[userId]) || 0}–${Number(event?.data?.remainingByUserId?.[opponentUserId]) || 0} pins left`,
        winnerUserIds: getWinnerUserIds(event),
    }
    const attempt = Math.max(0, Number(event?.data?.attempt) || 0)
    const winnerUserIds = getWinnerUserIds(event)
    const retryLabel = attempt > 0 ? ` · Retry ${attempt}` : (!winnerUserIds.length ? ' · Retry' : '')
    return {
        id: event.uid, kind: 'minigame', title: `Flutter Round ${roundNumber}${retryLabel}`,
        summary: `${Number(event?.data?.ringsClearedByUserId?.[userId]) || 0}–${Number(event?.data?.ringsClearedByUserId?.[opponentUserId]) || 0} rings cleared${winnerUserIds.length ? '' : ' · Simultaneous miss'}`,
        winnerUserIds,
    }
}

export const buildMatchEndRounds = ({ events = [], modeId, userId, opponentUserId, reviewQuestionsById = {} }) => {
    let questionNumber = 0
    const minigameType = modeId === 'sat-timber' ? 'TIMBER_ROUND_RESOLVED'
        : (modeId === 'sat-puncture' ? 'PUNCTURE_ROUND_RESOLVED' : 'FLUTTER_ROUND_RESOLVED')
    const supportedTypes = modeId === 'sat-classic' ? new Set(['ROUND_RESOLVED']) : new Set(['QUESTION_RESOLVED', minigameType])
    return [...events]
        .filter((event) => supportedTypes.has(event?.type))
        .sort((a, b) => Number(a?.sequence || 0) - Number(b?.sequence || 0))
        .map((event) => {
            if(!QUESTION_EVENT_TYPES.has(event.type)) return buildMinigameRound({ event, modeId, userId, opponentUserId })
            questionNumber += 1
            const results = getRoundResults(event)
            const localResult = results.find((entry) => entry?.userId === userId) ?? null
            const questionId = event?.data?.questionId ?? null
            return {
                id: event.uid ?? `${questionId ?? 'question'}-${questionNumber}`,
                kind: 'question', title: `Question ${questionNumber}`, questionId,
                question: reviewQuestionsById?.[questionId] ?? null,
                submittedResponse: localResult?.submittedResponse ?? null,
                correctAnswer: event?.data?.correctAnswer ?? null,
                isCorrect: Boolean(localResult?.isCorrect),
                winnerUserIds: getWinnerUserIds(event),
            }
        })
}

export const countAnsweredQuestions = (rounds = []) => new Set(rounds
    .filter((round) => round.kind === 'question' && String(round.submittedResponse ?? '').trim())
    .map((round) => round.questionId).filter(Boolean)).size
