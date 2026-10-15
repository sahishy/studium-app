import { readCircleContexts, writeCircleContextMigrations } from '../socials/circleGoals.js'
import { ensureMembershipIndex } from '../socials/circleMemberships.js'
import { auth, db } from '../../lib/firebaseAdmin.js'
import { getRandomQuestions } from '../games/questionsService.js'
import { placementOpponentElo } from '../games/satClassicUtils.js'
import { buildRankedResult, getModeElo } from './ratingState.js'
import { RANKED_MODE_IDS, computeTotalElo } from '../leaderboards/leaderboardService.js'
import { describeMasteryBoard, foldMastery } from '../mastery/masteryService.js'
import { sanitizeRealtimeResult } from './resultUtils.js'
import { eligibleMatchReward, performanceScore } from '../economy/progression.js'
import { readAccount, writeAccount } from '../economy/economyService.js'
import { applyQuestProgress, circleQuestInstances, questDayRef, resolveDayKey } from '../quests/questService.js'
import { buildMatchQuestEvents } from '../quests/matchQuestEvents.js'

// Matches that already paid out today, used to taper a long session's rewards. Stored per day on
// the stats document, so a stale key from a previous day reads as zero rather than carrying over.
const rewardedMatchesToday = (statsData = {}, dayKey = '') => (
    statsData?.dailyRewards?.dayKey === dayKey
        ? Math.max(0, Number(statsData.dailyRewards.rewardedMatches) || 0)
        : 0
)

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
        getModeElo(modeStats),
    ]))
    // For a mode the player has not placed in yet, this carries the rating their next placement
    // opponent should be pitched at. A new account is rated 0, and a bot built from that rating
    // would be trivial to beat - every player would place in the same spot regardless of skill.
    const placementByMode = Object.fromEntries(RANKED_MODE_IDS.map((modeId) => {
        const modeStats = playStats?.[modeId] ?? {}
        const placed = Boolean(modeStats.placed)
        return [modeId, {
            placed,
            gamesPlayed: Math.max(0, Number(modeStats.placementGamesPlayed) || 0),
            ...(placed ? {} : { nextOpponentElo: placementOpponentElo(modeStats.placementLog) }),
        }]
    }))

    return {
        userId: decoded.uid,
        displayName: user?.profile?.displayName || 'Player',
        profilePicture: user?.profile?.profilePicture ?? null,
        avatar: user?.profile?.avatar ?? null,
        title: user?.profile?.title ?? null,
        level: user?.progress?.level ?? 1,
        eloByMode,
        placementByMode,
    }
}

const getRealtimeQuestions = ({ count = 10 } = {}) => ({
    questions: getRandomQuestions({ count: Math.min(20, Math.max(1, Number(count) || 10)) }),
})

const saveRealtimeResult = async (result = {}) => {
    const gameId = String(result.gameId || '')
    const modeId = String(result.modeId || '')
    const {
        humanPlayerIds,
        persistedResult,
        performanceByUserId,
        gameplayByUserId,
        opponentEloByUserId,
    } = sanitizeRealtimeResult(result)
    if(!gameId || !modeId || !humanPlayerIds.length) {
        throw new Error('gameId, modeId, and playerIds are required.')
    }

    const resultRef = db.collection('gameResults').doc(gameId)
    await Promise.all(humanPlayerIds.map(ensureMembershipIndex))
    return db.runTransaction(async (transaction) => {
        const existing = await transaction.get(resultRef)
        if(existing.exists) return {
            ok: true,
            duplicate: true,
            eloDeltaByUserId: existing.data()?.eloDeltaByUserId ?? {},
            rewardsByUserId: existing.data()?.rewardsByUserId ?? {},
            placementByUserId: existing.data()?.placementByUserId ?? {},
        }

        const statsRefs = humanPlayerIds.map((userId) => db.collection('userStats').doc(userId))
        const statsSnaps = await Promise.all(statsRefs.map((ref) => transaction.get(ref)))
        const accounts = await Promise.all(humanPlayerIds.map((userId) => readAccount(transaction, userId)))
        const questDayKeys = accounts.map((account) => resolveDayKey(account))
        const questSnaps = await Promise.all(humanPlayerIds.map((userId, index) => transaction.get(questDayRef(userId, questDayKeys[index]))))
        const circleContexts = await readCircleContexts(transaction, humanPlayerIds, {
            questInstances: humanPlayerIds.flatMap((uid, i) => circleQuestInstances(uid, questDayKeys[i], questSnaps[i])),
        })
        writeCircleContextMigrations(transaction, circleContexts)
        const circleEloDeltas = new Map()
        const eloDeltaByUserId = {}
        const rewardsByUserId = {}
        const questsByUserId = {}
        const placementByUserId = {}
        const masteryByUserId = {}
        const now = new Date()

        humanPlayerIds.forEach((userId, index) => {
            const statsData = statsSnaps[index].exists ? statsSnaps[index].data() : {}
            const play = statsData?.play ?? {}
            const current = play?.[modeId] ?? {}
            const performance = performanceByUserId?.[userId] ?? null
            let nextModeStats = { ...current }

            if(modeId === 'blitz') {
                const score = Number(result?.scoreByUserId?.[userId]) || 0
                const previousBest = Number(current.peakScore) || 0
                nextModeStats = {
                    ...current,
                    gamesPlayed: (Number(current.gamesPlayed) || 0) + 1,
                    peakScore: previousBest > 0 ? Math.min(previousBest, score) : score,
                }
            } else if(result.ranked && RANKED_MODE_IDS.includes(modeId)) {
                const isWinner = result.winnerUserId === userId
                const isDraw = !result.winnerUserId
                const outcome = isDraw ? 'draw' : (isWinner ? 'win' : 'loss')
                // The opponent's rating has to come from the match itself: a bot has no stats
                // document to read it from. The player's own rating comes from Firestore, which is
                // authoritative and cannot be influenced by a stale value sent from a client.
                const rating = buildRankedResult({
                    current,
                    outcome,
                    opponentElo: Number(opponentEloByUserId?.[userId]) || 0,
                    performance: performanceScore({ performance, roundsPlayed: result.roundsPlayed }) ?? 0.5,
                    roundsPlayed: result.roundsPlayed,
                })
                nextModeStats = rating.nextModeStats
                eloDeltaByUserId[userId] = rating.eloDelta
                for (const context of circleContexts) if(context.members.includes(userId)) circleEloDeltas.set(context.ref.id, (circleEloDeltas.get(context.ref.id) || 0) + computeTotalElo({...play,[modeId]:rating.nextModeStats}) - computeTotalElo(play))
                if(rating.placement) placementByUserId[userId] = rating.placement
            }

            // Mastery accrues from any match that asked SAT questions, ranked or not: answering a
            // real question teaches the student something whether or not a rating was at stake.
            // Rewards and rating stay ranked-only, as before.
            const nextMastery = performance?.byDomain
                ? foldMastery(statsData?.mastery ?? {}, performance.byDomain, now)
                : null
            masteryByUserId[userId] = {
                before: describeMasteryBoard(statsData?.mastery ?? {}),
                after: describeMasteryBoard(nextMastery ?? statsData?.mastery ?? {}),
            }

            const reward = eligibleMatchReward(result, userId, {
                performance,
                selfElo: Number(current.elo) || 0,
                opponentElo: Number(opponentEloByUserId?.[userId]) || 0,
                priorRewardedMatchesToday: rewardedMatchesToday(statsData, questDayKeys[index]),
            })
            rewardsByUserId[userId] = reward

            if(modeId === 'blitz' || result.ranked || nextMastery) {
                const nextPlay = { ...play, [modeId]: nextModeStats }
                const updatePayload = {
                    userId,
                    play: nextPlay,
                    lastUpdated: now,
                }
                if(result.ranked) updatePayload.totalElo = computeTotalElo(nextPlay)
                if(nextMastery) updatePayload.mastery = nextMastery
                // Drives the tapering in eligibleMatchReward, so it only counts matches that
                // actually paid out.
                if(reward.xp) {
                    updatePayload.dailyRewards = {
                        dayKey: questDayKeys[index],
                        rewardedMatches: rewardedMatchesToday(statsData, questDayKeys[index]) + 1,
                    }
                }
                transaction.set(statsRefs[index], updatePayload, { merge: true })
            }

            // Only a reward-eligible match counts toward play quests, so a forfeit
            // or a match nobody engaged with cannot farm them.
            const questResult = reward.xp
                ? applyQuestProgress(transaction, {
                    userId,
                    dayKey: questDayKeys[index],
                    daySnap: questSnaps[index],
                    circleContexts,
                    events: buildMatchQuestEvents(result, userId, performance ?? {}, gameplayByUserId[userId]),
                })
                : { reward: { xp: 0, lumen: 0, crates: 0 }, completed: [], quests: [] }
            questsByUserId[userId] = { quests: questResult.quests, completed: questResult.completed, reward: questResult.reward }

            // Feeds the two earned titles that depend on match history. A perfect match needs a
            // real sample behind it, so a two-question forfeit cannot qualify as flawless.
            const counted = Boolean(reward.xp)
            const wonTheMatch = result.winnerUserId === userId
            const flawless = counted
                && Number(performance?.faced) >= 5
                && Number(performance?.correct) === Number(performance?.faced)
            const winStreak = counted
                ? (wonTheMatch ? (Number(accounts[index].progress.winStreak) || 0) + 1 : 0)
                : (Number(accounts[index].progress.winStreak) || 0)

            writeAccount(transaction, accounts[index], {
                xp: reward.xp + questResult.reward.xp,
                lumen: reward.lumen + questResult.reward.lumen,
                crates: questResult.reward.crates ?? 0,
                counter: counted ? 'rankedMatches' : null,
                counters: flawless ? ['perfectMatches'] : [],
                ...(counted ? {
                    progressPatch: {
                        winStreak,
                        bestWinStreak: Math.max(Number(accounts[index].progress.bestWinStreak) || 0, winStreak),
                    },
                } : {}),
            })
        })

        for (const context of circleContexts) {
            const delta = circleEloDeltas.get(context.ref.id) || 0
            if(delta) transaction.update(context.ref, {totalElo:context.totalElo + delta})
        }

        transaction.create(resultRef, {
            ...persistedResult,
            eloDeltaByUserId,
            rewardsByUserId,
            masteryByUserId,
            ...(Object.keys(placementByUserId).length ? { placementByUserId } : {}),
            createdAt: now,
        })
        return { ok: true, duplicate: false, eloDeltaByUserId, rewardsByUserId, questsByUserId, placementByUserId }
    })
}

export { verifyRealtimeUser, getRealtimeQuestions, saveRealtimeResult }
