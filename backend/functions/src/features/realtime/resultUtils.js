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
    const safeResult = { ...result }
    delete safeResult.botPlayerIds
    return {
        humanPlayerIds,
        outcomeByUserId,
        persistedResult: {
            ...safeResult,
            playerIds: humanPlayerIds,
            winnerUserId: humanPlayerIds.includes(result.winnerUserId) ? result.winnerUserId : null,
            ...(humanScoreByUserId ? { scoreByUserId: humanScoreByUserId } : {}),
            participationByUserId: humanParticipationByUserId,
            outcomeByUserId,
        },
    }
}

export { sanitizeRealtimeResult }
