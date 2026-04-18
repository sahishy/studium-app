import { useEffect, useMemo, useRef, useState } from 'react'
import { subscribeToRoomById, subscribeToRoomEvents, subscribeToRoomPlayers } from '../../services/roomService'
import { submitSatClassicAnswer } from './services/satClassicGameService'
import { getCurrentQuestion, getHealthBoard, getMyPlayer, hasAnsweredQuestion } from './utils/satClassicGameUtils'
import LoadingState from '../../../../shared/components/ui/LoadingState'
import { toDateFromFirestoreLike } from '../../../../shared/utils/formatters'
import { useToast } from '../../../../shared/contexts/ToastContext'
import { useUserStats } from '../../../profile/contexts/UserStatsContext'
import SatClassicSubmittedToast from './components/toasts/SatClassicSubmittedToast'
import ResultOverlay from './components/ResultOverlay'
import QuestionPane from './components/QuestionPane'
import GameHeader from './components/GameHeader'
import MatchEndOverlay from './components/MatchEndOverlay'
import { buildRankedUiState } from '../../utils/multiplayerUtils'
import { getRankInfoFromElo } from '../../../profile/utils/statsUtils'

const MODE_ID = 'sat-classic'
const OVERLAY_DURATION_MS = 3000

const SatClassicGame = ({ roomId, userId }) => {

    const [room, setRoom] = useState(null)
    const [players, setPlayers] = useState([])
    const [events, setEvents] = useState([])
    const [submittingChoiceId, setSubmittingChoiceId] = useState(null)
    const [lockedQuestionId, setLockedQuestionId] = useState(null)
    const [selectedChoiceId, setSelectedChoiceId] = useState(null)
    const [nowMs, setNowMs] = useState(Date.now())
    const [resultOverlay, setResultOverlay] = useState(null)
    const [damageIndicators, setDamageIndicators] = useState({ left: null, right: null })

    const previousHealthRef = useRef({ left: null, right: null })
    const shownRoundResolvedEventIdsRef = useRef(new Set())
    const shownAnswerToastEventIdsRef = useRef(new Set())
    const shownAnswerToastQuestionIdsRef = useRef(new Set())
    const lastProcessedAnswerSubmitSequenceRef = useRef(null)

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
    const matchStartedAt = toDateFromFirestoreLike(gameState?.startedAt)

    const elapsedRoundSeconds = roundStartedAt
        ? Math.max(0, Math.floor((nowMs - roundStartedAt.getTime()) / 1000))
        : 999

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
        setSelectedChoiceId(null)
    }, [currentQuestionId])

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
            const latestSequence = answerSubmittedEvents.reduce((max, e) => {
                const s = Number(e?.sequence)
                return Number.isFinite(s) ? Math.max(max, s) : max
            }, -Infinity)

            if(Number.isFinite(latestSequence)) {
                lastProcessedAnswerSubmitSequenceRef.current = latestSequence
            }

            return
        }

        answerSubmittedEvents.forEach((eventEntry) => {
            if(!eventEntry?.uid) return

            const questionId = eventEntry?.data?.questionId
            if(!questionId || shownAnswerToastQuestionIdsRef.current.has(questionId)) return
            if(shownAnswerToastEventIdsRef.current.has(eventEntry.uid)) return

            const eventSequence = Number(eventEntry?.sequence)
            if(!Number.isFinite(eventSequence) || eventSequence <= lastProcessedAnswerSubmitSequenceRef.current) {
                return
            }

            const submitter = players.find((e) => e?.userId === eventEntry?.actorUserId)

            shownAnswerToastEventIdsRef.current.add(eventEntry.uid)
            shownAnswerToastQuestionIdsRef.current.add(questionId)
            lastProcessedAnswerSubmitSequenceRef.current = Math.max(
                lastProcessedAnswerSubmitSequenceRef.current,
                eventSequence
            )

            showToast({
                component: SatClassicSubmittedToast,
                props: {
                    submitterName: submitter?.displayName || 'A player',
                    profilePicture: submitter?.profilePicture ?? null,
                },
                duration: 2200,
            })

        })
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

    const handleChoiceSelect = (choiceId) => {
        if(!isBusy) setSelectedChoiceId(choiceId)
    }

    const handleSubmitAnswer = async () => {
        if(!roomId || !userId || !selectedChoiceId || isBusy) return

        setLockedQuestionId(currentQuestionId)
        setSubmittingChoiceId(selectedChoiceId)

        try {
            await submitSatClassicAnswer({ roomId, userId, selectedChoiceId })
        } finally {
            setSubmittingChoiceId(null)
        }
    }

    if(isGameLoading) {
        return <LoadingState label='Loading SAT Classic...' className='min-h-[420px]' />
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
                elapsedSeconds={Math.max(0, elapsedRoundSeconds - (OVERLAY_DURATION_MS / 1000))}
                currentRoundMultiplier={currentRoundMultiplier}
            />

            <div className='relative flex-1 flex min-h-0'>
                <QuestionPane
                    gameState={gameState}
                    currentQuestion={currentQuestion}
                    selectedChoiceId={selectedChoiceId}
                    isBusy={isBusy}
                    hasAnswered={hasAnswered}
                    onChoiceSelect={handleChoiceSelect}
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

        </div>
    )

}

export default SatClassicGame