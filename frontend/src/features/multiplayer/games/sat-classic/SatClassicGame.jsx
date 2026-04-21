import { useEffect, useMemo, useRef, useState } from 'react'
import { subscribeToRoomById, subscribeToRoomEvents, subscribeToRoomPlayers } from '../../services/roomService'
import { submitSatClassicAnswer } from './services/satClassicGameService'
import { getCurrentQuestion, getHealthBoard, getMyPlayer, hasAnsweredQuestion, MODE_ID, OVERLAY_DURATION_MS, ROUND_DURATION_MS } from './utils/satClassicGameUtils'
import LoadingState from '../../../../shared/components/ui/LoadingState'
import { toDateFromFirestoreLike } from '../../../../shared/utils/formatters'
import { useToast } from '../../../../shared/contexts/ToastContext'
import { useUserStats } from '../../../profile/contexts/UserStatsContext'
import SatClassicSubmittedToast from './components/toasts/SatClassicSubmittedToast'
import ResultOverlay from './components/ResultOverlay'
import QuestionPane from './components/QuestionPane'
import GameHeader from './components/GameHeader'
import MatchEndOverlay from './components/MatchEndOverlay'
import CalculatorWindow from '../../components/windows/CalculatorWindow'
import { buildRankedUiState } from '../../utils/multiplayerUtils'
import { getRankInfoFromElo } from '../../../profile/utils/statsUtils'

const SatClassicGame = ({ roomId, userId }) => {

    const [room, setRoom] = useState(null)
    const [players, setPlayers] = useState([])
    const [events, setEvents] = useState([])
    const [submittingChoiceId, setSubmittingChoiceId] = useState(null)
    const [lockedQuestionId, setLockedQuestionId] = useState(null)
    const [submittedResponse, setSubmittedResponse] = useState('')
    const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)
    const [nowMs, setNowMs] = useState(Date.now())
    const [resultOverlay, setResultOverlay] = useState(null)
    const [damageIndicators, setDamageIndicators] = useState({ left: null, right: null })

    const previousHealthRef = useRef({ left: null, right: null })
    const shownRoundResolvedEventIdsRef = useRef(new Set())
    const shownAnswerToastEventIdsRef = useRef(new Set())
    const shownAnswerToastQuestionIdsRef = useRef(new Set())
    const lastProcessedAnswerSubmitSequenceRef = useRef(null)
    const timeoutSubmittedQuestionIdsRef = useRef(new Set())

    const { showToast } = useToast()
    const { userStats } = useUserStats()

    useEffect(() => {
        if(!roomId) return

        const unsubRoom = subscribeToRoomById(roomId, setRoom)
        const unsubPlayers = subscribeToRoomPlayers(roomId, setPlayers)
        const unsubEvents = subscribeToRoomEvents(roomId, setEvents)

        return () => {
            unsubRoom()
            unsubPlayers()
            unsubEvents()
        }
    }, [roomId])

    const gameState = room?.state ?? {}

    const { questionId: currentQuestionId, question: currentQuestion } = useMemo(
        () => getCurrentQuestion(gameState),
        [gameState]
    )

    const myPlayer = useMemo(
        () => getMyPlayer({ players, userId }),
        [players, userId]
    )

    const healthBoard = useMemo(
        () => getHealthBoard({ players, userId }),
        [players, userId]
    )

    const roundStartedAt = toDateFromFirestoreLike(gameState?.currentRoundStartedAt)
    const roundDeadlineAt = toDateFromFirestoreLike(gameState?.currentRoundDeadlineAt)
        ?? (roundStartedAt ? new Date(roundStartedAt.getTime() + ROUND_DURATION_MS) : null)
    const matchStartedAt = toDateFromFirestoreLike(gameState?.startedAt)

    const elapsedRoundSeconds = roundStartedAt
        ? Math.max(0, Math.floor((nowMs - roundStartedAt.getTime()) / 1000))
        : 999

    const remainingRoundSeconds = roundDeadlineAt
        ? Math.max(0, Math.floor((roundDeadlineAt.getTime() - nowMs) / 1000))
        : 0
    const displayRoundSeconds = Math.min(Math.floor((ROUND_DURATION_MS - OVERLAY_DURATION_MS) / 1000), remainingRoundSeconds)

    const roundCountdown = Math.max(0, 3 - elapsedRoundSeconds)

    const roundOverlayRemainingMs = roundStartedAt
        ? Math.max(0, OVERLAY_DURATION_MS - (nowMs - roundStartedAt.getTime()))
        : 0

    const isGameLoading = !currentQuestionId
        || !currentQuestion
        || !matchStartedAt
        || !roundStartedAt

    const hasAnswered = hasAnsweredQuestion({
        player: myPlayer,
        questionId: currentQuestionId,
    })

    const isLocked = Boolean(currentQuestionId) && lockedQuestionId === currentQuestionId

    const resultOverlayRemainingMs = resultOverlay
        ? Math.max(0, resultOverlay.durationMs - (nowMs - resultOverlay.startedAtMs))
        : 0

    const isResultOverlayActive = resultOverlayRemainingMs > 0

    const isBusy = isGameLoading
        || hasAnswered
        || isLocked
        || Boolean(submittingChoiceId)
        || roundCountdown > 0
        || isResultOverlayActive

    useEffect(() => {
        if((hasAnswered && lockedQuestionId === currentQuestionId) || 
            (lockedQuestionId && currentQuestionId && lockedQuestionId !== currentQuestionId)) 
        {
            setLockedQuestionId(null)
        }
    }, [hasAnswered, lockedQuestionId, currentQuestionId])

    useEffect(() => {
        setSubmittedResponse('')
    }, [currentQuestionId])

    useEffect(() => {
        if(!roomId || !userId || !currentQuestionId || !roundDeadlineAt || hasAnswered) return

        if(nowMs < roundDeadlineAt.getTime()) return
        if(timeoutSubmittedQuestionIdsRef.current.has(currentQuestionId)) return

        timeoutSubmittedQuestionIdsRef.current.add(currentQuestionId)

        void submitSatClassicAnswer({
            roomId,
            userId,
            submittedResponse: '',
            isTimeout: true,
        }).catch(() => {
            timeoutSubmittedQuestionIdsRef.current.delete(currentQuestionId)
        })
    }, [roomId, userId, currentQuestionId, roundDeadlineAt, hasAnswered, nowMs])

    const questionType = String(currentQuestion?.questionType ?? 'mcq').toLowerCase()
    const isSprQuestion = questionType === 'spr'

    useEffect(() => {
        const intervalId = setInterval(() => setNowMs(Date.now()), 50)
        return () => clearInterval(intervalId)
    }, [])

    useEffect(() => {

        const leftHealth = Math.max(0, Number(healthBoard.leftPlayer?.health) || 0)
        const rightHealth = Math.max(0, Number(healthBoard.rightPlayer?.health) || 0)

        const previousLeft = previousHealthRef.current.left
        const previousRight = previousHealthRef.current.right

        if(Number.isFinite(previousLeft) && previousLeft > leftHealth) {
            setDamageIndicators((prev) => ({
                ...prev,
                left: {
                    amount: previousLeft - leftHealth,
                    startedAtMs: Date.now(),
                },
            }))
        }

        if(Number.isFinite(previousRight) && previousRight > rightHealth) {
            setDamageIndicators((prev) => ({
                ...prev,
                right: {
                    amount: previousRight - rightHealth,
                    startedAtMs: Date.now(),
                },
            }))
        }

        previousHealthRef.current = { left: leftHealth, right: rightHealth }

    }, [healthBoard.leftPlayer?.health, healthBoard.rightPlayer?.health])

    useEffect(() => {

        if(!events.length || room?.status !== 'active' || room?.modeId !== MODE_ID) return

        const answerSubmittedEvents = events.filter((e) => e?.type === 'ANSWER_SUBMITTED')
        if(!answerSubmittedEvents.length) return

        if(lastProcessedAnswerSubmitSequenceRef.current == null) {
            const latestNonAnswerSequence = events.reduce((max, e) => {
                if(e?.type === 'ANSWER_SUBMITTED') return max

                const s = Number(e?.sequence)
                return Number.isFinite(s) ? Math.max(max, s) : max
            }, -Infinity)

            lastProcessedAnswerSubmitSequenceRef.current = Number.isFinite(latestNonAnswerSequence)
                ? latestNonAnswerSequence
                : -Infinity
        }

        const currentCursor = Number.isFinite(lastProcessedAnswerSubmitSequenceRef.current)
            ? lastProcessedAnswerSubmitSequenceRef.current
            : -Infinity

        const incomingAnswerSubmittedEvents = answerSubmittedEvents
            .map((eventEntry) => ({
                eventEntry,
                sequence: Number(eventEntry?.sequence),
            }))
            .filter(({ sequence }) => Number.isFinite(sequence) && sequence > currentCursor)
            .sort((a, b) => a.sequence - b.sequence)

        if(!incomingAnswerSubmittedEvents.length) return

        let maxProcessedSequence = currentCursor

        incomingAnswerSubmittedEvents.forEach(({ eventEntry, sequence }) => {
            maxProcessedSequence = Math.max(maxProcessedSequence, sequence)

            if(!eventEntry?.uid) return
            if(eventEntry?.data?.isTimeout) return

            const questionId = eventEntry?.data?.questionId
            if(!questionId || shownAnswerToastQuestionIdsRef.current.has(questionId)) return
            if(shownAnswerToastEventIdsRef.current.has(eventEntry.uid)) return

            const submitter = players.find((e) => e?.userId === eventEntry?.actorUserId)

            shownAnswerToastEventIdsRef.current.add(eventEntry.uid)
            shownAnswerToastQuestionIdsRef.current.add(questionId)

            showToast({
                component: SatClassicSubmittedToast,
                props: {
                    submitterName: submitter?.displayName || 'A player',
                    profilePicture: submitter?.profilePicture ?? null,
                },
                duration: 2200,
            })

        })

        lastProcessedAnswerSubmitSequenceRef.current = maxProcessedSequence
    }, [events, players, showToast, room?.status, room?.modeId])

    useEffect(() => {
        if(!events.length || !userId) return

        events.forEach((eventEntry) => {
            if (eventEntry?.type !== 'ROUND_RESOLVED' || !eventEntry?.uid) return
            if (shownRoundResolvedEventIdsRef.current.has(eventEntry.uid)) return

            const roundResults = Array.isArray(eventEntry?.data?.roundResults)
                ? eventEntry.data.roundResults
                : []

            const myRoundResult = roundResults.find((e) => e?.userId === userId)
            const opponentRoundResult = roundResults.find((e) => e?.userId !== userId)

            if(!myRoundResult) return

            shownRoundResolvedEventIdsRef.current.add(eventEntry.uid)

            setResultOverlay({
                type: 'round_result',
                startedAtMs: Date.now(),
                durationMs: OVERLAY_DURATION_MS,
                questionId: eventEntry?.data?.questionId,
                myResult: myRoundResult,
                opponentResult: opponentRoundResult ?? null,
                correctAnswer: eventEntry?.data?.correctAnswer ?? null,
            })
        })
    }, [events, userId])

    const currentRoundMultiplier = Number(gameState?.currentRoundMultiplier) || 1
    const isMatchFinished = gameState?.phase === 'finished'
    const winnerUserId = gameState?.winnerUserId ?? null
    const latestGameEndedEvent = [...events].reverse().find((eventEntry) => eventEntry?.type === 'GAME_ENDED')
    const matchEndReason = latestGameEndedEvent?.data?.endReason ?? null
    const matchEndedAt =
        toDateFromFirestoreLike(latestGameEndedEvent?.createdAt)
        ?? toDateFromFirestoreLike(gameState?.updatedAt)
        ?? null
    const matchDurationSeconds = (matchStartedAt && matchEndedAt)
        ? Math.max(0, Math.floor((matchEndedAt.getTime() - matchStartedAt.getTime()) / 1000))
        : 0
    const roundHistory = useMemo(() => {
        return events
            .filter((eventEntry) => eventEntry?.type === 'ROUND_RESOLVED')
            .map((eventEntry, idx) => {
                const roundResults = Array.isArray(eventEntry?.data?.roundResults) ? eventEntry.data.roundResults : []
                const myRoundResult = roundResults.find((entry) => entry?.userId === userId)
                const opponentRoundResult = roundResults.find((entry) => entry?.userId !== userId)

                return {
                    id: eventEntry?.uid ?? `${eventEntry?.data?.questionId ?? 'q'}-${idx}`,
                    roundNumber: idx + 1,
                    correctAnswer: eventEntry?.data?.correctAnswer ?? null,
                    myCorrect: Boolean(myRoundResult?.isCorrect),
                    opponentCorrect: Boolean(opponentRoundResult?.isCorrect),
                }
            })
    }, [events, userId])

    const rankedProgression = useMemo(() => {
        const {
            rankedStats,
            rankInfo,
            currentTierMinElo,
            currentTierSpan,
            currentTierProgress,
            eloToNextTier,
            rankLabel,
            nextTierLabel,
            nextTierThreshold,
        } = buildRankedUiState({ userStats, modeId: MODE_ID })

        const nextRankInfo = nextTierThreshold
            ? getRankInfoFromElo(nextTierThreshold.minElo)
            : null

        return {
            rankInfo,
            rankLabel,
            nextRankInfo,
            nextTierLabel,
            nextTierThreshold,
            currentTierMinElo,
            currentTierSpan,
            currentTierProgress,
            eloToNextTier,
            rankedElo: rankedStats.elo,
            peakProgress: Math.max(0, rankedStats.peakElo - currentTierMinElo),
        }
    }, [userStats])

    const activeOverlayMode = isResultOverlayActive
        ? resultOverlay?.type
        : (roundOverlayRemainingMs > 0 ? 'round_start' : null)
    const showMatchEndOverlay = isMatchFinished && !isResultOverlayActive

    useEffect(() => {
        if((isResultOverlayActive || showMatchEndOverlay) && isCalculatorOpen) {
            setIsCalculatorOpen(false)
        }
    }, [isResultOverlayActive, showMatchEndOverlay, isCalculatorOpen])

    const handleChoiceSelect = (choiceId) => {
        if(!isBusy) {
            setSubmittedResponse(String(choiceId ?? ''))
        }
    }

    const handleResponseChange = (value) => {
        if(!isBusy) {
            setSubmittedResponse(value)
        }
    }

    const handleSubmitAnswer = async () => {
        const trimmedResponse = String(submittedResponse ?? '').trim()
        if(!roomId || !userId || !trimmedResponse || isBusy) return

        setLockedQuestionId(currentQuestionId)
        setSubmittingChoiceId(trimmedResponse)

        try {
            await submitSatClassicAnswer({ roomId, userId, submittedResponse: trimmedResponse })
        } finally {
            setSubmittingChoiceId(null)
        }
    }

    if(isGameLoading) {
        return <LoadingState className='min-h-[420px]' />
    }

    if(showMatchEndOverlay) {
        return (
            <MatchEndOverlay
                winnerUserId={winnerUserId}
                userId={userId}
                endReason={matchEndReason}
                healthBoard={healthBoard}
                matchDurationSeconds={matchDurationSeconds}
                rankedProgression={rankedProgression}
                rounds={roundHistory}
            />
        )
    }

    return (
        <div className='w-full h-full min-h-[420px] flex flex-col gap-12'>

            <GameHeader
                healthBoard={healthBoard}
                damageIndicators={damageIndicators}
                elapsedSeconds={displayRoundSeconds}
                currentRoundMultiplier={currentRoundMultiplier}
            />

            <div className='relative flex-1 flex min-h-0'>
                <QuestionPane
                    gameState={gameState}
                    currentQuestion={currentQuestion}
                    submittedResponse={submittedResponse}
                    isSprQuestion={isSprQuestion}
                    isCalculatorOpen={isCalculatorOpen}
                    onToggleCalculator={() => setIsCalculatorOpen((previous) => !previous)}
                    isBusy={isBusy}
                    hasAnswered={hasAnswered}
                    onChoiceSelect={handleChoiceSelect}
                    onResponseChange={handleResponseChange}
                    onSubmit={() => void handleSubmitAnswer()}
                />

                <ResultOverlay
                    activeOverlayMode={activeOverlayMode}
                    roundCountdown={roundCountdown}
                    roundOverlayRemainingMs={roundOverlayRemainingMs}
                    resultOverlay={resultOverlay}
                    nowMs={nowMs}
                    currentQuestion={currentQuestion}
                    players={players}
                    userId={userId}
                />

            </div>

            <CalculatorWindow
                isOpen={isCalculatorOpen}
                onClose={() => setIsCalculatorOpen(false)}
            />

        </div>
    )

}

export default SatClassicGame