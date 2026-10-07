import { auth, db } from '../../lib/firebaseAdmin.js'
import { getRandomQuestions } from '../games/questionsService.js'
import { getRankedEloDelta } from '../games/satClassicUtils.js'
import { computeTotalElo } from '../leaderboards/leaderboardService.js'
import { sanitizeRealtimeResult } from './resultUtils.js'
import { eligibleMatchReward } from '../economy/progression.js'
import { readAccount, writeAccount } from '../economy/economyService.js'
import { applyQuestProgress, questDayRef, resolveDayKey } from '../quests/questService.js'

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
            rewardsByUserId: existing.data()?.rewardsByUserId ?? {},
        }

        const statsRefs = humanPlayerIds.map((userId) => db.collection('userStats').doc(userId))
        const statsSnaps = await Promise.all(statsRefs.map((ref) => transaction.get(ref)))
        const accounts = await Promise.all(humanPlayerIds.map((userId) => readAccount(transaction, userId)))
        const questDayKeys = accounts.map((account) => resolveDayKey(account))
        const questSnaps = await Promise.all(humanPlayerIds.map((userId, index) => transaction.get(questDayRef(userId, questDayKeys[index]))))
        const eloDeltaByUserId = {}
        const rewardsByUserId = {}
        const questsByUserId = {}

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
                const nextPlay = { ...play, [modeId]: nextModeStats }
                const updatePayload = {
                    userId,
                    play: nextPlay,
                    lastUpdated: new Date(),
                }
                if(result.ranked) updatePayload.totalElo = computeTotalElo(nextPlay)
                transaction.set(statsRefs[index], updatePayload, { merge: true })
            }
            const reward = eligibleMatchReward(result, userId)
            rewardsByUserId[userId] = reward

            // Only a reward-eligible match counts toward play quests, so a forfeit
            // or a match nobody engaged with cannot farm them.
            const questResult = reward.xp
                ? applyQuestProgress(transaction, {
                    userId,
                    dayKey: questDayKeys[index],
                    daySnap: questSnaps[index],
                    events: [
                        { metric: 'match_played', amount: 1 },
                        { metric: `mode:${modeId}`, amount: 1 },
                        ...(result.winnerUserId === userId ? [{ metric: 'match_won', amount: 1 }] : []),
                    ],
                })
                : { reward: { xp: 0, lumen: 0 }, completed: [], quests: [] }
            questsByUserId[userId] = { quests: questResult.quests, completed: questResult.completed, reward: questResult.reward }

            writeAccount(transaction, accounts[index], {
                xp: reward.xp + questResult.reward.xp,
                lumen: reward.lumen + questResult.reward.lumen,
                counter: reward.xp ? 'rankedMatches' : null,
            })
            transaction.create(db.collection('rewardEvents').doc(`match_${gameId}_${userId}`), {
                type: 'ranked_match', gameId, userId, ...reward, createdAt: new Date(),
            })
        })

        transaction.create(resultRef, {
            ...persistedResult,
            eloDeltaByUserId,
            rewardsByUserId,
            createdAt: new Date(),
        })
        return { ok: true, duplicate: false, eloDeltaByUserId, rewardsByUserId, questsByUserId }
    })
}

export { verifyRealtimeUser, getRealtimeQuestions, saveRealtimeResult }
