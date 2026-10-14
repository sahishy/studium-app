const average = (values) => (values.length
    ? Math.round(values.reduce((total, value) => total + value, 0) / values.length)
    : 0)

const sanitizeRealtimeResult = (result = {}) => {
    const playerIds = Array.isArray(result.playerIds) ? result.playerIds.filter(Boolean) : []
    const botPlayerIds = new Set(Array.isArray(result.botPlayerIds) ? result.botPlayerIds.filter(Boolean) : [])
    const humanPlayerIds = playerIds.filter((userId) => !botPlayerIds.has(userId))
    const outcomeByUserId = Object.fromEntries(humanPlayerIds.map((userId) => [
        userId,
        !result.winnerUserId ? 'draw' : (result.winnerUserId === userId ? 'win' : 'loss'),
    ]))
    const humanScoreByUserId = result.scoreByUserId
        ? Object.fromEntries(humanPlayerIds.map((userId) => [userId, Number(result.scoreByUserId?.[userId]) || 0]))
        : undefined
    const humanParticipationByUserId = Object.fromEntries(humanPlayerIds.map((userId) => [userId, Math.max(0, Number(result.participationByUserId?.[userId]) || 0)]))

    // Question telemetry is only ever read back for the humans in the match, so the bots' copies
    // are dropped here rather than filtered again at every consumer.
    const humanPerformanceByUserId = result.performanceByUserId
        ? Object.fromEntries(humanPlayerIds
            .filter((userId) => result.performanceByUserId[userId])
            .map((userId) => [userId, result.performanceByUserId[userId]]))
        : {}

    // Ratings are keyed by every player, bots included, because pricing an underdog win needs the
    // opponent's rating. They are collapsed per human here and deliberately kept out of
    // persistedResult, which is the only object written to Firestore.
    const selfEloByUserId = Object.fromEntries(humanPlayerIds.map((userId) => [
        userId,
        Number(result.eloByUserId?.[userId]) || 0,
    ]))
    const opponentEloByUserId = Object.fromEntries(humanPlayerIds.map((userId) => [
        userId,
        average(playerIds.filter((id) => id !== userId).map((id) => Number(result.eloByUserId?.[id]) || 0)),
    ]))

    const safeResult = { ...result }
    delete safeResult.botPlayerIds
    delete safeResult.eloByUserId

    return {
        humanPlayerIds,
        outcomeByUserId,
        performanceByUserId: humanPerformanceByUserId,
        selfEloByUserId,
        opponentEloByUserId,
        persistedResult: {
            ...safeResult,
            playerIds: humanPlayerIds,
            winnerUserId: humanPlayerIds.includes(result.winnerUserId) ? result.winnerUserId : null,
            ...(humanScoreByUserId ? { scoreByUserId: humanScoreByUserId } : {}),
            ...(result.performanceByUserId ? { performanceByUserId: humanPerformanceByUserId } : {}),
            participationByUserId: humanParticipationByUserId,
            outcomeByUserId,
        },
    }
}

export { sanitizeRealtimeResult }
