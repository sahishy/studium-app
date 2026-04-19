import { db } from '../../../../../lib/firebaseAdmin.js'
import { asDate } from '../../../../../utils/formatters.js'
import { getRandomQuestions } from '../../../services/questionsService.js'
import { addRoomEvent } from '../../../services/roomEventsService.js'
import { MULTIPLAYER_MODE_IDS } from '../../../utils/multiplayerUtils.js'
import {
    ANSWERED_FIRST_MULTIPLIER,
    SAT_CLASSIC_INITIAL_HEALTH,
    SAT_CLASSIC_LOSS_ELO_DELTA,
    SAT_CLASSIC_MAX_QUESTIONS,
    SAT_CLASSIC_POST_SUBMIT_GRACE_MS,
    SAT_CLASSIC_ROUND_DURATION_MS,
    SAT_CLASSIC_WIN_ELO_DELTA,
    buildPlayerStateMap,
    buildUserStatsByUserId,
    calculateDamage,
    deriveWinnerFromHealth,
    evaluateQuestionAnswer,
    getBaseDamageByDifficulty,
    getRoundDamageMultiplier,
    resolveRoundAnswers,
    resolveRoundDamageOutcome,
} from '../utils/satClassicUtils.js'

const MODE_ID = MULTIPLAYER_MODE_IDS.SAT_CLASSIC

const applyRankedMatchResult = async ({ transaction, userId, modeId, eloDelta = 0, userStatsData = null }) => {

    if(!transaction || !userId || !modeId) {
        return
    }

    const resolvedEloDelta = Number(eloDelta) || 0
    if(!resolvedEloDelta) {
        return
    }

    const userStatsRef = db.collection('userStats').doc(userId)
    let resolvedUserStatsData = userStatsData

    if(!resolvedUserStatsData || typeof resolvedUserStatsData !== 'object') {
        const userStatsSnap = await transaction.get(userStatsRef)
        resolvedUserStatsData = userStatsSnap.exists ? (userStatsSnap.data() ?? {}) : {}
    }

    const currentRanked = resolvedUserStatsData?.ranked ?? {}
    const modeStats = currentRanked?.[modeId] ?? {}

    const currentElo = Number(modeStats?.elo) || 0
    const currentPeakElo = Number(modeStats?.peakElo) || currentElo

    const nextElo = Math.max(0, currentElo + resolvedEloDelta)
    const nextPeakElo = Math.max(currentPeakElo, nextElo)

    const nextRanked = {
        ...currentRanked,
        [modeId]: {
            ...modeStats,
            elo: nextElo,
            peakElo: nextPeakElo,
        },
    }

    transaction.set(userStatsRef, {
        userId,
        ranked: nextRanked,
        lastUpdated: new Date(),
    }, { merge: true })

}

const endSatClassicGameInTransaction = async ({
    transaction,
    roomId,
    roomData = {},
    playerIds = [],
    winnerUserId = null,
    endReason = 'max_questions',
    now = new Date(),
    userStatsByUserId = {},
    health = [],
    eventSequence = null,
}) => {

    if(!transaction || !roomId) {
        throw new Error('transaction and roomId are required to end SAT Classic game.')
    }

    const roomModeId = roomData?.modeId ?? MODE_ID
    const state = roomData?.state ?? {}

    if(roomModeId !== MODE_ID || state?.phase === 'finished') {
        return {
            ok: false,
            ended: false,
            eventSequence: Number(state?.eventSequence) || 0,
        }
    }

    const resolvedPlayerIds = Array.isArray(playerIds) ? playerIds.filter(Boolean) : []
    const resolvedWinnerUserId = resolvedPlayerIds.includes(winnerUserId) ? winnerUserId : null

    if(resolvedWinnerUserId) {
        await applyRankedMatchResult({
            transaction,
            userId: resolvedWinnerUserId,
            modeId: MODE_ID,
            eloDelta: SAT_CLASSIC_WIN_ELO_DELTA,
            userStatsData: userStatsByUserId[resolvedWinnerUserId] ?? null,
        })

        const loserUserId = resolvedPlayerIds.find((playerId) => playerId && playerId !== resolvedWinnerUserId) ?? null
        if(loserUserId) {
            await applyRankedMatchResult({
                transaction,
                userId: loserUserId,
                modeId: MODE_ID,
                eloDelta: SAT_CLASSIC_LOSS_ELO_DELTA,
                userStatsData: userStatsByUserId[loserUserId] ?? null,
            })
        }
    }

    const resolvedEventSequence = Number.isFinite(eventSequence)
        ? Number(eventSequence)
        : ((Number(state?.eventSequence) || 0) + 1)
    const roomRef = db.collection('multiplayerRooms').doc(roomId)

    transaction.set(roomRef, {
        state: {
            phase: 'finished',
            winnerUserId: resolvedWinnerUserId,
            roundWinnerUserId: null,
            eventSequence: resolvedEventSequence,
            updatedAt: now,
        },
        updatedAt: now,
    }, { merge: true })

    await addRoomEvent({
        roomId,
        type: 'GAME_ENDED',
        modeId: MODE_ID,
        actorUserId: null,
        sequence: resolvedEventSequence,
        data: {
            winnerUserId: resolvedWinnerUserId,
            health: Array.isArray(health) ? health : [],
            endReason,
        },
        transaction,
    })

    return {
        ok: true,
        ended: true,
        winnerUserId: resolvedWinnerUserId,
        eventSequence: resolvedEventSequence,
    }

}

const initializeSatClassicRoomState = ({ roomId, playerIds = [], transaction, now = new Date() }) => {

    if(!roomId || !transaction) {
        throw new Error('roomId and transaction are required to initialize sat-classic room state.')
    }

    const resolvedPlayerIds = Array.isArray(playerIds) ? playerIds.filter(Boolean) : []
    const questions = getRandomQuestions({ count: SAT_CLASSIC_MAX_QUESTIONS })
    const questionIds = questions.map((question) => question.id)
    const questionsById = Object.fromEntries(questions.map((question) => [question.id, question]))
    const roomRef = db.collection('multiplayerRooms').doc(roomId)

    transaction.set(roomRef, {
        state: {
            phase: 'question_active',
            initialHealth: SAT_CLASSIC_INITIAL_HEALTH,
            maxQuestions: SAT_CLASSIC_MAX_QUESTIONS,
            questionIndex: 0,
            currentRoundMultiplier: getRoundDamageMultiplier(0),
            questionIds,
            questionsById,
            currentQuestionId: questionIds[0] ?? null,
            currentRoundStartedAt: now,
            currentRoundDeadlineAt: new Date(now.getTime() + SAT_CLASSIC_ROUND_DURATION_MS),
            roundWinnerUserId: null,
            winnerUserId: null,
            eventSequence: 1,
            startedAt: now,
            updatedAt: now,
        },
        updatedAt: now,
    }, { merge: true })

    resolvedPlayerIds.forEach((playerId) => {
        const playerRef = db.collection('multiplayerRooms').doc(roomId).collection('players').doc(playerId)
        transaction.set(playerRef, {
            userId: playerId,
            state: {
                health: SAT_CLASSIC_INITIAL_HEALTH,
                answeredQuestionIds: [],
                lastAnswer: null,
            },
        }, { merge: true })
    })

    return {
        type: 'SAT_CLASSIC_INITIALIZED',
        modeId: MODE_ID,
        actorUserId: null,
        sequence: 1,
        data: { initializedAt: now },
    }

}

const submitSatClassicAnswer = async ({ roomId, userId, submittedResponse = null, isTimeout = false }) => {

    if(!roomId || !userId) {
        throw new Error('roomId and userId are required.')
    }

    const roomRef = db.collection('multiplayerRooms').doc(roomId)

    await db.runTransaction(async (transaction) => {

        const roomSnap = await transaction.get(roomRef)

        if(!roomSnap.exists) {
            throw new Error('Room does not exist.')
        }

        const roomData = roomSnap.data() ?? {}
        const state = roomData.state ?? {}
        const roomModeId = roomData.modeId ?? MODE_ID

        if(roomModeId !== MODE_ID || state?.phase === 'finished') {
            return
        }

        const playerIds = Array.isArray(roomData.playerIds) ? roomData.playerIds.filter(Boolean) : []
        const currentQuestionId = state.currentQuestionId
        const questionIndex = Number(state.questionIndex) || 0
        const maxQuestions = Number(state.maxQuestions) || SAT_CLASSIC_MAX_QUESTIONS
        const currentQuestion = state?.questionsById?.[currentQuestionId] ?? null

        if(!currentQuestionId || !currentQuestion) {
            return
        }

        const playerRefs = playerIds.map((playerId) => db.collection('multiplayerRooms').doc(roomId).collection('players').doc(playerId))
        const playerSnaps = await Promise.all(playerRefs.map((playerRef) => transaction.get(playerRef)))
        const playerStateMap = buildPlayerStateMap({ playerIds, playerSnaps })

        const userStatsRefs = playerIds.map((playerId) => db.collection('userStats').doc(playerId))
        const userStatsSnaps = await Promise.all(userStatsRefs.map((userStatsRef) => transaction.get(userStatsRef)))
        const userStatsByUserId = buildUserStatsByUserId({ playerIds, userStatsSnaps })

        const currentPlayerState = playerStateMap[userId] ?? {}
        const alreadyAnswered = Array.isArray(currentPlayerState.answeredQuestionIds)
            ? currentPlayerState.answeredQuestionIds.includes(currentQuestionId)
            : false

        if(alreadyAnswered) {
            return
        }

        const now = new Date()
        const currentRoundStartedAt = asDate(state.currentRoundStartedAt) ?? asDate(state.updatedAt) ?? asDate(state.startedAt) ?? now
        const currentRoundDeadlineAt = asDate(state.currentRoundDeadlineAt)
            ?? new Date(currentRoundStartedAt.getTime() + SAT_CLASSIC_ROUND_DURATION_MS)
        const questionType = String(currentQuestion?.questionType ?? 'mcq').toLowerCase()
        const normalizedSubmittedResponse = typeof submittedResponse === 'string' ? submittedResponse.trim() : ''
        const isTimeoutSubmission = Boolean(isTimeout)

        if(!normalizedSubmittedResponse && !isTimeoutSubmission) {
            throw new Error('submittedResponse is required.')
        }

        const isCorrect = (!isTimeoutSubmission && normalizedSubmittedResponse)
            ? evaluateQuestionAnswer({
                question: currentQuestion,
                submittedResponse: normalizedSubmittedResponse,
            }).isCorrect
            : false

        const selectedChoiceId = (questionType === 'spr' || isTimeoutSubmission || !normalizedSubmittedResponse)
            ? null
            : normalizedSubmittedResponse.toUpperCase()
        const answeredQuestionIds = [...(currentPlayerState.answeredQuestionIds ?? []), currentQuestionId]

        const elapsedMs = Math.max(0, now.getTime() - currentRoundStartedAt.getTime())
        const elapsedSec = elapsedMs / 1000

        const opponentUserId = playerIds.find((playerId) => playerId !== userId) ?? null
        const roundMultiplier = getRoundDamageMultiplier(questionIndex)

        const baseDamage = isCorrect ? getBaseDamageByDifficulty(currentQuestion?.difficulty) : 0
        const { damage, timeMultiplier } = calculateDamage({ baseDamage, elapsedMs, roundMultiplier })
        let nextSequence = (Number(state.eventSequence) || 0) + 1

        const emitEvent = async ({ type, data = {}, actorUserId: actorId = userId }) => {

            await addRoomEvent({
                roomId,
                type,
                modeId: MODE_ID,
                actorUserId: actorId,
                sequence: nextSequence,
                data,
                transaction,
            })

            nextSequence += 1

        }

        transaction.set(db.collection('multiplayerRooms').doc(roomId).collection('players').doc(userId), {
            userId,
            state: {
                ...currentPlayerState,
                answeredQuestionIds,
                lastAnswer: {
                    questionId: currentQuestionId,
                    selectedChoiceId,
                    submittedResponse: normalizedSubmittedResponse || null,
                    isTimeout: isTimeoutSubmission,
                    difficulty: currentQuestion?.difficulty ?? null,
                    isCorrect,
                    elapsedMs,
                    elapsedSec,
                    baseDamage,
                    roundMultiplier,
                    timeMultiplier,
                    damageDealt: isCorrect ? damage : 0,
                    targetUserId: isCorrect ? opponentUserId : null,
                    submittedAt: now,
                },
            },
        }, { merge: true })

        await emitEvent({
            type: 'ANSWER_SUBMITTED',
            data: {
                questionId: currentQuestionId,
                selectedChoiceId,
                submittedResponse: normalizedSubmittedResponse || null,
                isTimeout: isTimeoutSubmission,
            },
        })

        const allAnsweredCurrentQuestion = playerIds.every((playerId) => {
            if(playerId === userId) {
                return true
            }

            const playerAnswered = playerStateMap[playerId]?.answeredQuestionIds ?? []
            return playerAnswered.includes(currentQuestionId)
        })

        if(!allAnsweredCurrentQuestion) {
            const shortenedDeadlineAt = new Date(Math.min(
                currentRoundDeadlineAt.getTime(),
                now.getTime() + SAT_CLASSIC_POST_SUBMIT_GRACE_MS,
            ))

            transaction.set(roomRef, {
                state: {
                    currentRoundDeadlineAt: shortenedDeadlineAt,
                    eventSequence: nextSequence - 1,
                    updatedAt: now,
                },
                updatedAt: now,
            }, { merge: true })
            return
        }

        const latestPlayerStateMap = { ...playerStateMap }
        latestPlayerStateMap[userId] = {
            ...currentPlayerState,
            answeredQuestionIds,
            lastAnswer: {
                questionId: currentQuestionId,
                selectedChoiceId,
                submittedResponse: normalizedSubmittedResponse || null,
                isTimeout: isTimeoutSubmission,
                difficulty: currentQuestion?.difficulty ?? null,
                isCorrect,
                elapsedMs,
                elapsedSec,
                baseDamage,
                roundMultiplier,
                timeMultiplier,
                damageDealt: isCorrect ? damage : 0,
                targetUserId: isCorrect ? opponentUserId : null,
                submittedAt: now,
            },
        }

        const roundResultsByUserId = resolveRoundAnswers({
            playerIds,
            playerStateMap: latestPlayerStateMap,
            questionId: currentQuestionId,
            correctAnswer: currentQuestion.correctAnswer,
            roundMultiplier,
        })

        const correctPlayerIds = playerIds.filter((playerId) => Boolean(roundResultsByUserId[playerId]?.isCorrect))
        if(correctPlayerIds.length === 2) {
            const [firstCorrectUserId, secondCorrectUserId] = correctPlayerIds
            const firstElapsedMs = Number(roundResultsByUserId[firstCorrectUserId]?.elapsedMs) || 0
            const secondElapsedMs = Number(roundResultsByUserId[secondCorrectUserId]?.elapsedMs) || 0

            if(firstElapsedMs !== secondElapsedMs) {
                const answeredFirstUserId = firstElapsedMs < secondElapsedMs ? firstCorrectUserId : secondCorrectUserId

                correctPlayerIds.forEach((playerId) => {
                    const answeredFirstMultiplier = playerId === answeredFirstUserId ? ANSWERED_FIRST_MULTIPLIER : 1
                    const currentDamageRaw = Number(roundResultsByUserId[playerId]?.damageRaw) || 0

                    roundResultsByUserId[playerId] = {
                        ...roundResultsByUserId[playerId],
                        answeredFirstMultiplier,
                        damageRaw: Math.round(currentDamageRaw * answeredFirstMultiplier),
                    }
                })
            }
        }

        const {
            nextHealthByUserId,
            damageTransfer,
            roundResultsByUserId: resolvedRoundResultsByUserId,
        } = resolveRoundDamageOutcome({
            playerIds,
            playerStateMap: latestPlayerStateMap,
            roundResultsByUserId,
            initialHealth: SAT_CLASSIC_INITIAL_HEALTH,
        })

        playerIds.forEach((playerId) => {
            transaction.set(db.collection('multiplayerRooms').doc(roomId).collection('players').doc(playerId), {
                userId: playerId,
                state: {
                    health: nextHealthByUserId[playerId],
                },
            }, { merge: true })
        })

        for(const attackerUserId of playerIds) {
            const attackerResult = resolvedRoundResultsByUserId[attackerUserId]
            if(!(Number(attackerResult?.damageDealt) > 0)) {
                continue
            }

            const attackedUserId = attackerResult?.targetUserId
            await emitEvent({
                type: 'DAMAGE_APPLIED',
                actorUserId: attackerUserId,
                data: {
                    questionId: currentQuestionId,
                    attackerUserId,
                    targetUserId: attackedUserId,
                    difficulty: currentQuestion?.difficulty ?? null,
                    baseDamage: attackerResult.baseDamage,
                    roundMultiplier: attackerResult.roundMultiplier,
                    elapsedSec: attackerResult.elapsedSec,
                    timeMultiplier: attackerResult.timeMultiplier,
                    damage: attackerResult.damageDealt,
                    remainingHealth: nextHealthByUserId[attackedUserId],
                },
            })
        }

        await emitEvent({
            type: 'ROUND_RESOLVED',
            data: {
                questionId: currentQuestionId,
                correctAnswer: currentQuestion.correctAnswerDisplay ?? currentQuestion.correctAnswer,
                roundResults: playerIds.map((playerId) => resolvedRoundResultsByUserId[playerId]),
                damageTransfer,
            },
        })

        const updatedHealth = playerIds.map((playerId) => ({
            userId: playerId,
            health: nextHealthByUserId[playerId],
        }))

        const hasKnockout = updatedHealth.some((entry) => entry.health <= 0)
        const outOfQuestions = (questionIndex + 1) >= maxQuestions
        const shouldFinish = hasKnockout || outOfQuestions

        if(shouldFinish) {
            const winnerUserId = hasKnockout
                ? (updatedHealth.find((entry) => entry.health > 0)?.userId ?? null)
                : deriveWinnerFromHealth(updatedHealth)

            await endSatClassicGameInTransaction({
                transaction,
                roomId,
                roomData,
                playerIds,
                winnerUserId,
                endReason: hasKnockout ? 'knockout' : 'max_questions',
                now,
                userStatsByUserId,
                health: updatedHealth,
                eventSequence: nextSequence,
            })

            transaction.set(roomRef, {
                state: {
                    eventSequence: nextSequence,
                },
            }, { merge: true })

            return
        }

        const nextQuestionIndex = questionIndex + 1
        const nextQuestionId = state.questionIds?.[nextQuestionIndex] ?? null
        const nextRoundMultiplier = getRoundDamageMultiplier(nextQuestionIndex)

        transaction.set(roomRef, {
            state: {
                phase: 'question_active',
                questionIndex: nextQuestionIndex,
                currentRoundMultiplier: nextRoundMultiplier,
                currentQuestionId: nextQuestionId,
                currentRoundStartedAt: now,
                currentRoundDeadlineAt: new Date(now.getTime() + SAT_CLASSIC_ROUND_DURATION_MS),
                roundWinnerUserId: null,
                eventSequence: nextSequence,
                updatedAt: now,
            },
            updatedAt: now,
        }, { merge: true })

        await emitEvent({
            type: 'ROUND_STARTED',
            actorUserId: null,
            data: {
                questionIndex: nextQuestionIndex,
                questionId: nextQuestionId,
                roundStartedAt: now,
                roundDeadlineAt: new Date(now.getTime() + SAT_CLASSIC_ROUND_DURATION_MS),
            },
        })

        transaction.set(roomRef, {
            state: {
                eventSequence: nextSequence - 1,
            },
        }, { merge: true })

    })

    return { ok: true }

}

export {
    initializeSatClassicRoomState,
    submitSatClassicAnswer,
    endSatClassicGameInTransaction,
}