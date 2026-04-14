import { doc, runTransaction } from 'firebase/firestore'
import { appendRoomEvent } from '../../../services/multiplayerService'
import { getQuestionById, getRandomQuestions } from '../../../services/questionService'
import { getRoundDamageMultiplier } from '../utils/satClassicGameUtils'
import { applyRankedMatchResult } from '../../../../profile/services/statsService'
import { db } from '../../../../../lib/firebase'

const MODE_ID = 'sat-classic'

const ROOMS_COLLECTION = 'multiplayerRooms'

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

const asDate = (value) => {
    if (!value) return null
    if (typeof value?.toDate === 'function') return value.toDate()
    const dateValue = new Date(value)
    return Number.isNaN(dateValue.getTime()) ? null : dateValue
}

const getBaseDamageByDifficulty = (difficulty) => {
    const normalizedDifficulty = String(difficulty ?? '').trim().toLowerCase()
    if (normalizedDifficulty === 'easy') return SAT_CLASSIC_BASE_DAMAGE.Easy
    if (normalizedDifficulty === 'hard') return SAT_CLASSIC_BASE_DAMAGE.Hard
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

    if (!healthEntries.length) {
        return null
    }

    const sortedHealth = [...healthEntries].sort((a, b) => b.health - a.health)
    if (sortedHealth.length < 2 || sortedHealth[0].health > sortedHealth[1].health) {
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

const initializeSatClassicGame = async ({ roomId }) => {

    if (!roomId) {
        throw new Error('roomId is required to initialize satClassicGame.')
    }

    const roomRef = doc(db, ROOMS_COLLECTION, roomId)

    await runTransaction(db, async (transaction) => {
        const roomSnap = await transaction.get(roomRef)

        if (!roomSnap.exists()) {
            throw new Error('Room does not exist.')
        }

        const roomData = roomSnap.data() ?? {}
        const playerIds = Array.isArray(roomData.playerIds) ? roomData.playerIds.filter(Boolean) : []
        const existingState = roomData.state ?? {}
        const roomModeId = roomData.modeId ?? MODE_ID

        if (roomModeId !== MODE_ID || Array.isArray(existingState?.questionIds)) {
            return
        }

        const questions = getRandomQuestions({ count: SAT_CLASSIC_MAX_QUESTIONS })
        const questionIds = questions.map((questionEntry) => questionEntry.id)
        const currentQuestionId = questionIds[0] ?? null
        const now = new Date()

        transaction.set(roomRef, {
            state: {
                phase: 'question_active',
                initialHealth: SAT_CLASSIC_INITIAL_HEALTH,
                maxQuestions: SAT_CLASSIC_MAX_QUESTIONS,
                questionIndex: 0,
                questionIds,
                currentQuestionId,
                currentRoundStartedAt: now,
                roundWinnerUserId: null,
                winnerUserId: null,
                eventSequence: 0,
                startedAt: now,
                updatedAt: now,
            },
            updatedAt: now,
        }, { merge: true })

        playerIds.forEach((playerId) => {
            const playerRef = doc(db, ROOMS_COLLECTION, roomId, 'players', playerId)
            transaction.set(playerRef, {
                userId: playerId,
                state: {
                    health: SAT_CLASSIC_INITIAL_HEALTH,
                    answeredQuestionIds: [],
                    lastAnswer: null,
                },
            }, { merge: true })
        })
    })

}

const submitSatClassicAnswer = async ({ roomId, userId, selectedChoiceId }) => {

    if (!roomId || !userId || !selectedChoiceId) {
        throw new Error('roomId, userId, and selectedChoiceId are required to submit an answer.')
    }

    const roomRef = doc(db, ROOMS_COLLECTION, roomId)

    await runTransaction(db, async (transaction) => {
        const roomSnap = await transaction.get(roomRef)

        if (!roomSnap.exists()) {
            throw new Error('Room does not exist.')
        }

        const roomData = roomSnap.data() ?? {}
        const state = roomData.state ?? {}
        const roomModeId = roomData.modeId ?? MODE_ID

        if (roomModeId !== MODE_ID || state?.phase === 'finished') {
            return
        }

        const playerIds = Array.isArray(roomData.playerIds) ? roomData.playerIds.filter(Boolean) : []
        const currentQuestionId = state.currentQuestionId
        const questionIndex = Number(state.questionIndex) || 0
        const maxQuestions = Number(state.maxQuestions) || SAT_CLASSIC_MAX_QUESTIONS
        const currentQuestion = getQuestionById(currentQuestionId)

        if (!currentQuestionId || !currentQuestion) {
            return
        }

        const playerRefs = playerIds.map((playerId) => doc(db, ROOMS_COLLECTION, roomId, 'players', playerId))
        const playerSnaps = await Promise.all(playerRefs.map((playerRef) => transaction.get(playerRef)))
        const playerStateMap = {}
        const userStatsRefs = playerIds.map((playerId) => doc(db, 'userStats', playerId))
        const userStatsSnaps = await Promise.all(userStatsRefs.map((userStatsRef) => transaction.get(userStatsRef)))
        const userStatsByUserId = {}

        playerSnaps.forEach((playerSnap, index) => {
            const playerId = playerIds[index]
            playerStateMap[playerId] = playerSnap.exists() ? (playerSnap.data()?.state ?? {}) : {}
        })

        userStatsSnaps.forEach((userStatsSnap, index) => {
            const playerId = playerIds[index]
            userStatsByUserId[playerId] = userStatsSnap.exists() ? (userStatsSnap.data() ?? {}) : {}
        })

        const currentPlayerState = playerStateMap[userId] ?? {}
        const alreadyAnswered = Array.isArray(currentPlayerState.answeredQuestionIds)
            ? currentPlayerState.answeredQuestionIds.includes(currentQuestionId)
            : false

        if (alreadyAnswered) {
            return
        }

        const isCorrect = selectedChoiceId === currentQuestion.correctAnswer
        const answeredQuestionIds = [...(currentPlayerState.answeredQuestionIds ?? []), currentQuestionId]

        const now = new Date()
        const currentRoundStartedAt = asDate(state.currentRoundStartedAt) ?? asDate(state.updatedAt) ?? asDate(state.startedAt) ?? now
        const elapsedMs = Math.max(0, now.getTime() - currentRoundStartedAt.getTime())
        const elapsedSec = elapsedMs / 1000

        const opponentUserId = playerIds.find((playerId) => playerId !== userId) ?? null
        const roundMultiplier = getRoundDamageMultiplier(questionIndex)

        const baseDamage = isCorrect ? getBaseDamageByDifficulty(currentQuestion?.difficulty) : 0
        const { damage, timeMultiplier } = calculateDamage({ baseDamage, elapsedMs, roundMultiplier })
        let nextSequence = (Number(state.eventSequence) || 0) + 1

        const emitEvent = async ({ type, data = {}, actorUserId = userId }) => {
            await appendRoomEvent({
                roomId,
                type,
                modeId: MODE_ID,
                actorUserId,
                sequence: nextSequence,
                data,
                transaction,
            })

            nextSequence += 1
        }

        transaction.set(doc(db, ROOMS_COLLECTION, roomId, 'players', userId), {
            userId,
            state: {
                ...currentPlayerState,
                answeredQuestionIds,
                lastAnswer: {
                    questionId: currentQuestionId,
                    selectedChoiceId,
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
            },
        })

        const allAnsweredCurrentQuestion = playerIds.every((playerId) => {
            if (playerId === userId) {
                return true
            }

            const playerAnswered = playerStateMap[playerId]?.answeredQuestionIds ?? []
            return playerAnswered.includes(currentQuestionId)
        })

        const shouldResolveRound = allAnsweredCurrentQuestion
        if (!shouldResolveRound) {
            transaction.set(roomRef, {
                state: {
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
        if (correctPlayerIds.length === 2) {
            const [firstCorrectUserId, secondCorrectUserId] = correctPlayerIds
            const firstElapsedMs = Number(roundResultsByUserId[firstCorrectUserId]?.elapsedMs) || 0
            const secondElapsedMs = Number(roundResultsByUserId[secondCorrectUserId]?.elapsedMs) || 0

            if (firstElapsedMs !== secondElapsedMs) {
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

        const healthBeforeByUserId = Object.fromEntries(playerIds.map((playerId) => ([
            playerId,
            Number(latestPlayerStateMap[playerId]?.health) || SAT_CLASSIC_INITIAL_HEALTH,
        ])))
        const nextHealthByUserId = { ...healthBeforeByUserId }

        const [firstUserId, secondUserId] = playerIds

        const firstRawDamage = Number(roundResultsByUserId[firstUserId]?.damageRaw) || 0
        const secondRawDamage = Number(roundResultsByUserId[secondUserId]?.damageRaw) || 0

        const sourceUserId = firstRawDamage > secondRawDamage ? firstUserId : secondUserId
        const targetUserId = sourceUserId === firstUserId ? secondUserId : firstUserId

        const sourceRawDamage = Math.max(firstRawDamage, secondRawDamage)
        const targetRawDamage = Math.min(firstRawDamage, secondRawDamage)
        const netDamage = Math.max(0, sourceRawDamage - targetRawDamage)

        const damageTransfer = {
            bothCorrect: firstRawDamage > 0 && secondRawDamage > 0,
            isTie: firstRawDamage === secondRawDamage,
            sourceUserId: netDamage > 0
                ? sourceUserId
                : (firstRawDamage === secondRawDamage ? firstUserId : null),
            targetUserId: netDamage > 0
                ? targetUserId
                : (firstRawDamage === secondRawDamage ? secondUserId : null),
            sourceRawDamage,
            targetRawDamage,
            netDamage,
        }

        if (netDamage > 0 && targetUserId) {
            nextHealthByUserId[targetUserId] = Math.max(
                0,
                (nextHealthByUserId[targetUserId] ?? SAT_CLASSIC_INITIAL_HEALTH) - netDamage
            )

            roundResultsByUserId[sourceUserId] = {
                ...roundResultsByUserId[sourceUserId],
                damageDealt: netDamage,
                targetUserId,
            }
        }

        playerIds.forEach((playerId) => {
            transaction.set(doc(db, ROOMS_COLLECTION, roomId, 'players', playerId), {
                userId: playerId,
                state: {
                    health: nextHealthByUserId[playerId],
                },
            }, { merge: true })
        })

        for (const attackerUserId of playerIds) {
            const attackerResult = roundResultsByUserId[attackerUserId]
            if (!(Number(attackerResult?.damageDealt) > 0)) {
                continue
            }

            const targetUserId = attackerResult?.targetUserId
            await emitEvent({
                type: 'DAMAGE_APPLIED',
                actorUserId: attackerUserId,
                data: {
                    questionId: currentQuestionId,
                    attackerUserId,
                    targetUserId,
                    difficulty: currentQuestion?.difficulty ?? null,
                    baseDamage: attackerResult.baseDamage,
                    roundMultiplier: attackerResult.roundMultiplier,
                    elapsedSec: attackerResult.elapsedSec,
                    timeMultiplier: attackerResult.timeMultiplier,
                    damage: attackerResult.damageDealt,
                    remainingHealth: nextHealthByUserId[targetUserId],
                },
            })
        }

        await emitEvent({
            type: 'ROUND_RESOLVED',
            data: {
                questionId: currentQuestionId,
                correctAnswer: currentQuestion.correctAnswer,
                roundResults: playerIds.map((playerId) => roundResultsByUserId[playerId]),
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

            if(winnerUserId) {
                await applyRankedMatchResult({
                    userId: winnerUserId,
                    modeId: MODE_ID,
                    eloDelta: SAT_CLASSIC_WIN_ELO_DELTA,
                    transaction,
                    userStatsData: userStatsByUserId[winnerUserId] ?? {},
                })

                const loserUserId = playerIds.find((playerId) => playerId && playerId !== winnerUserId) ?? null
                if(loserUserId) {
                    await applyRankedMatchResult({
                        userId: loserUserId,
                        modeId: MODE_ID,
                        eloDelta: SAT_CLASSIC_LOSS_ELO_DELTA,
                        transaction,
                        userStatsData: userStatsByUserId[loserUserId] ?? {},
                    })
                }
            }

            transaction.set(roomRef, {
                state: {
                    phase: 'finished',
                    winnerUserId,
                    roundWinnerUserId: null,
                    eventSequence: nextSequence,
                    updatedAt: now,
                },
                updatedAt: now,
            }, { merge: true })

            await emitEvent({
                type: 'GAME_ENDED',
                actorUserId: null,
                data: {
                    winnerUserId,
                    health: updatedHealth,
                    endReason: hasKnockout ? 'knockout' : 'max_questions',
                },
            })

            

            transaction.set(roomRef, {
                state: {
                    eventSequence: nextSequence - 1,
                },
            }, { merge: true })

            return
        }

        const nextQuestionIndex = questionIndex + 1
        const nextQuestionId = state.questionIds?.[nextQuestionIndex] ?? null

        transaction.set(roomRef, {
            state: {
                phase: 'question_active',
                questionIndex: nextQuestionIndex,
                currentQuestionId: nextQuestionId,
                currentRoundStartedAt: now,
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
            },
        })

        transaction.set(roomRef, {
            state: {
                eventSequence: nextSequence - 1,
            },
        }, { merge: true })
    })

}

export {
    SAT_CLASSIC_INITIAL_HEALTH,
    SAT_CLASSIC_MAX_QUESTIONS,
    initializeSatClassicGame,
    submitSatClassicAnswer,
}
