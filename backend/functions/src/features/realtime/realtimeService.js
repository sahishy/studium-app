import { auth, db } from '../../lib/firebaseAdmin.js'
import { getRandomQuestions } from '../games/questionsService.js'
import { getRankedEloDelta } from '../games/satClassicUtils.js'
import { sanitizeRealtimeResult } from './resultUtils.js'

const verifyRealtimeUser = async (idToken) => {
    const decoded = await auth.verifyIdToken(idToken)
    const [userSnap, statsSnap] = await Promise.all([
        db.collection('users').doc(decoded.uid).get(),
        db.collection('userStats').doc(decoded.uid).get(),
    ])
    const user = userSnap.exists ? userSnap.data() : {}
    const playStats = statsSnap.exists ? (statsSnap.data()?.play ?? {}) : {}
    const eloByMode = Object.fromEntries(Object.entries(playStats).map(([modeId, modeStats]) => [
        modeId,
        Number(modeStats?.elo) || 0,
    ]))
    return {
        userId: decoded.uid,
        displayName: user?.profile?.displayName || 'Player',
        profilePicture: user?.profile?.profilePicture ?? null,
        avatar: user?.profile?.avatar ?? null,
        eloByMode,
    }
}

const getRealtimeQuestions = ({ count = 10 } = {}) => ({
    questions: getRandomQuestions({ count: Math.min(20, Math.max(1, Number(count) || 10)) }),
})

const saveRealtimeResult = async (result = {}) => {
    const gameId = String(result.gameId || '')
    const modeId = String(result.modeId || '')
    const { humanPlayerIds, persistedResult } = sanitizeRealtimeResult(result)
    if(!gameId || !modeId || !humanPlayerIds.length) {
        throw new Error('gameId, modeId, and playerIds are required.')
    }

    const resultRef = db.collection('gameResults').doc(gameId)
    return db.runTransaction(async (transaction) => {
        const existing = await transaction.get(resultRef)
        if(existing.exists) return {
            ok: true,
            duplicate: true,
            eloDeltaByUserId: existing.data()?.eloDeltaByUserId ?? {},
        }

        const statsRefs = humanPlayerIds.map((userId) => db.collection('userStats').doc(userId))
        const statsSnaps = await Promise.all(statsRefs.map((ref) => transaction.get(ref)))
        const eloDeltaByUserId = {}

        humanPlayerIds.forEach((userId, index) => {
            const statsData = statsSnaps[index].exists ? statsSnaps[index].data() : {}
            const play = statsData?.play ?? {}
            const current = play?.[modeId] ?? {}
            let nextModeStats = { ...current }

            if(modeId === 'blitz') {
                const score = Number(result?.scoreByUserId?.[userId]) || 0
                const previousBest = Number(current.peakScore) || 0
                nextModeStats = {
                    ...current,
                    gamesPlayed: (Number(current.gamesPlayed) || 0) + 1,
                    peakScore: previousBest > 0 ? Math.min(previousBest, score) : score,
                }
            } else if(result.ranked && ['sat-classic', 'sat-timber', 'sat-puncture', 'sat-flutter'].includes(modeId)) {
                const isWinner = result.winnerUserId === userId
                const isDraw = !result.winnerUserId
                const eloDelta = isDraw ? 0 : getRankedEloDelta({
                    isWin: isWinner,
                    isLoss: !isWinner,
                    roundsPlayed: result.roundsPlayed,
                })
                const nextElo = Math.max(0, (Number(current.elo) || 0) + eloDelta)
                eloDeltaByUserId[userId] = eloDelta
                nextModeStats = {
                    ...current,
                    elo: nextElo,
                    peakElo: Math.max(Number(current.peakElo) || 0, nextElo),
                    gamesPlayed: (Number(current.gamesPlayed) || 0) + 1,
                }
            }

            if(modeId === 'blitz' || result.ranked) {
                transaction.set(statsRefs[index], {
                    userId,
                    play: { ...play, [modeId]: nextModeStats },
                    lastUpdated: new Date(),
                }, { merge: true })
            }
        })

        transaction.create(resultRef, {
            ...persistedResult,
            eloDeltaByUserId,
            createdAt: new Date(),
        })
        return { ok: true, duplicate: false, eloDeltaByUserId }
    })
}

export { verifyRealtimeUser, getRealtimeQuestions, saveRealtimeResult }
