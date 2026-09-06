import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    getGameServerNow,
    requestGameResync,
    sendGameMessage,
    subscribeToGameActionResults,
    subscribeToGameReconnect,
    subscribeToGameSnapshot,
} from '../../services/realtimeSocketService'
import QuestionPane from '../sat-classic/components/QuestionPane'
import MatchEndOverlay from '../sat-classic/components/MatchEndOverlay'
import { buildMatchEndRounds, countAnsweredQuestions } from '../sat-classic/utils/matchEndUtils'
import CalculatorWindow from '../../components/windows/CalculatorWindow'
import LoadingState from '../../../../shared/components/ui/LoadingState'
import ProgressBar from '../../../../shared/components/ui/ProgressBar'
import Card from '../../../../shared/components/ui/Card'
import { areGameTeammates, buildMultiplayerUiState } from '../../utils/multiplayerUtils'
import { useUserStats } from '../../../profile/contexts/UserStatsContext'
import { getRankInfoFromElo } from '../../../profile/utils/statsUtils'
import AvatarPicture from '../../../../shared/components/avatar/AvatarPicture'
import AvatarStack from '../../../../shared/components/avatar/AvatarStack'
import SatClassicSubmittedToast from '../sat-classic/components/toasts/SatClassicSubmittedToast'
import { useToast } from '../../../../shared/contexts/ToastContext'
import useScreenShake from '../../../../shared/utils/useScreenShake'
import PunctureScene from './components/PunctureScene'
import { predictShot, STUN_MS } from './puncturePrediction'
import {
    appendPendingShot,
    applyShotOverlay,
    getUnconfirmedShots,
    mergeShotEvents,
    predictionAngles,
    pruneConfirmedShots,
    recalculatePendingShots,
    reconcileActionResult,
} from './punctureShotLedger'

const EMPTY_PLAYERS = []
const EMPTY_SHOTS = []
const MODE_ID = 'sat-puncture'
const QUESTION_DURATION_MS = 120_000
const PUNCTURE_ROUND_DURATION_MS = 30_000
const QUESTION_REVEAL_DURATION_MS = 2_000
const SHOT_RECEIPT_TIMEOUT_MS = 2_000

const formatClock = (milliseconds = 0) => {
    const secondsTotal = Math.max(0, Math.ceil((Number(milliseconds) || 0) / 1000))
    const minutes = Math.floor(secondsTotal / 60)
    const seconds = secondsTotal % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const ScorePanel = ({ player, align = 'start' }) => {
    const isEndAligned = align === 'end'
    return (
        <div className={`flex-1 max-w-xs ${isEndAligned ? 'items-end' : ''}`}>
            <div className={`flex items-center gap-3 ${isEndAligned ? 'flex-row-reverse' : ''}`}>
                <AvatarPicture
                    profile={{ profile: { profilePicture: player?.profilePicture ?? null } }}
                    avatar={player?.avatar}
                    className='w-12 h-12'
                />
                <div className={`min-w-0 ${isEndAligned ? 'text-right' : ''}`}>
                    <p className='text-sm truncate'>{player?.displayName || 'Waiting...'}</p>
                    <p className='text-2xl font-semibold tabular-nums'>{Number(player?.state?.score) || 0}</p>
                </div>
            </div>
        </div>
    )
}

const PunctureHeader = ({ localPlayer, opponent, remainingMs }) => {
    const seconds = Math.max(0, Math.ceil((Number(remainingMs) || 0) / 1000))
    const [isPopping, setIsPopping] = useState(false)
    const previousSecondRef = useRef(seconds)
    const popTimeoutRef = useRef(null)
    const isLowTime = seconds <= 15

    useEffect(() => {
        if(isLowTime && previousSecondRef.current !== seconds) {
            setIsPopping(true)
            if(popTimeoutRef.current) clearTimeout(popTimeoutRef.current)
            popTimeoutRef.current = setTimeout(() => setIsPopping(false), 160)
        }
        previousSecondRef.current = seconds
    }, [seconds, isLowTime])

    useEffect(() => () => {
        if(popTimeoutRef.current) clearTimeout(popTimeoutRef.current)
    }, [])

    return (
        <div className='w-full flex items-center justify-between gap-6'>
            <ScorePanel player={localPlayer} />
            <p className={`text-2xl font-semibold tabular-nums transition-all duration-150 ${isLowTime ? 'text-red-500' : ''} ${isPopping ? 'scale-110' : 'scale-100'}`}>
                {formatClock(remainingMs)}
            </p>
            <ScorePanel player={opponent} align='end' />
        </div>
    )
}

const PunctureBoard = ({ player, gameState, shotEvents = [], playbackResetKey = 0, isFaded = false, now, slowdownStartedAt = null, serverNow }) => {
    const playerState = player?.state ?? {}
    const pinsRemaining = Math.max(0, Number(playerState.pinsRemaining) || 0)
    const stunnedMs = Math.max(0, Number(playerState.stunnedUntil || 0) - now)
    const playerColor = player?.avatar?.color || player?.profile?.avatar?.color || '#60a5fa'

    return (
        <Card className={`relative flex-1 min-w-0 max-w-[34rem] h-full min-h-[420px] overflow-hidden p-0! transition-opacity duration-500 ${isFaded ? 'opacity-35' : 'opacity-100'} ${stunnedMs > 0 ? 'ring-2 ring-red-400' : ''}`}>
            <div className='pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-white via-white/55 to-transparent' />
            <PunctureScene
                generatedPinAngles={gameState?.generatedPinAngles ?? []}
                attachedPinAngles={playerState.puncturePinAngles ?? []}
                rotationTurnsPerSecond={gameState?.rotationTurnsPerSecond}
                roundStartedAt={gameState?.punctureRoundStartedAt}
                pinsRemaining={pinsRemaining}
                roundIndex={gameState?.punctureRoundIndex}
                playbackResetKey={playbackResetKey}
                shotEvents={shotEvents}
                slowdownStartedAt={slowdownStartedAt}
                playerColor={playerColor}
                serverNow={serverNow}
            />

            {stunnedMs > 0 ? (
                <div className='pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-red-500/10'>
                    <p className='text-3xl font-bold text-red-400'>STUNNED</p>
                </div>
            ) : null}
        </Card>
    )
}

const TransitionOverlay = ({ remainingMs = 0, countdown = null, title, subtitle = null }) => {
    const progressRatio = Math.max(0, Math.min(1, Number(remainingMs) / 3_000))
    return (
        <div className='absolute inset-0 z-30 pb-10 bg-neutral6/60 backdrop-blur-sm flex items-center justify-center'>
            <div className='pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-neutral6 to-transparent' />
            <div className='pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-neutral6 to-transparent' />
            <div className='pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-neutral6 to-transparent' />
            <div className='pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-neutral6 to-transparent' />
            <div className='text-center'>
                {countdown != null
                    ? <p className='text-6xl font-bold leading-none'>{countdown}</p>
                    : <p className='text-4xl font-bold leading-none'>{title}</p>}
                <p className='text-sm text-neutral1 mt-2'>{countdown != null ? title : subtitle}</p>
            </div>
            <div className='absolute left-5 right-5 bottom-4 h-1.5 overflow-hidden'>
                <div className='h-full bg-neutral0 rounded-full transition-all duration-75 ease-linear' style={{ width: `${progressRatio * 100}%` }} />
            </div>
        </div>
    )
}

const LegacyPunctureMatchEnd = ({ snapshot, userId, startedAt }) => {
    const { userStats } = useUserStats()
    const state = snapshot?.room?.state ?? {}
    const players = snapshot?.players ?? EMPTY_PLAYERS
    const winnerUserId = state.winnerUserId ?? null
    const isDraw = !winnerUserId
    const isWin = winnerUserId === userId
    const endedEvent = [...(snapshot?.events ?? [])].reverse().find((event) => event.type === 'GAME_ENDED')
    const eloDelta = Number(endedEvent?.data?.eloDeltaByUserId?.[userId]) || 0
    const progression = buildMultiplayerUiState({ userStats, modeId: MODE_ID })
    const nextRankInfo = progression.nextTierThreshold ? getRankInfoFromElo(progression.nextTierThreshold.minElo) : null
    let punctureRoundNumber = 0
    const gameRounds = (snapshot?.events ?? [])
        .filter((event) => event.type === 'QUESTION_RESOLVED' || event.type === 'PUNCTURE_ROUND_RESOLVED')
        .map((event) => {
            const isQuestion = event.type === 'QUESTION_RESOLVED'
            if(!isQuestion) punctureRoundNumber += 1
            return { ...event, kind: isQuestion ? 'question' : 'puncture', punctureRoundNumber }
        })
    const endedAt = Number(endedEvent?.createdAt) || Date.now()
    const localPlayer = players.find((player) => player.userId === userId) ?? null
    const opponent = players.find((player) => player.userId !== userId) ?? null
    const endReason = endedEvent?.data?.endReason ?? null
    const reasonLabel = endReason === 'first_to_three'
        ? (isWin ? 'You won the Puncture match.' : 'Your opponent won the Puncture match.')
        : (endReason === 'max_questions'
            ? 'Reached max questions'
            : (endReason === 'player_left'
                ? (isWin ? 'Your opponent left the match.' : 'You left the match.')
                : null))
    const eloDeltaLabel = eloDelta > 0 ? `+${eloDelta}` : `${eloDelta}`

    return (
        <div className='w-full h-full min-h-[420px] flex flex-col items-center px-6 py-10 overflow-y-auto'>
            <div className='text-center mb-8'>
                <p className={`text-5xl font-bold ${isDraw ? 'text-neutral1' : isWin ? 'text-sat0' : 'text-red-400'} leading-none mb-2`}>
                    {isDraw ? 'Draw' : isWin ? 'Victory' : 'Defeat'}
                </p>
                {reasonLabel ? <p className='text-sm text-neutral1'>{reasonLabel}</p> : null}
            </div>

            <div className='w-full max-w-4xl mb-6 flex items-center justify-between gap-6'>
                <ScorePanel player={localPlayer} />
                <div className='shrink-0 text-center'>
                    <p className='text-2xl font-semibold tabular-nums'>{formatClock(endedAt - Number(startedAt || endedAt))}</p>
                    <p className='text-sm text-neutral1'>Match Duration</p>
                </div>
                <ScorePanel player={opponent} align='end' />
            </div>

            {snapshot?.room?.ranked ? <>
                <h2 className='text-2xl font-bold mt-9 mb-6 underline underline-offset-12 decoration-neutral2'>Your Rank</h2>
                <div className='w-full max-w-xl mb-8 flex flex-col gap-4'>
                    <div className='grid grid-cols-2 gap-4'>
                        <div className='flex items-center gap-3'>
                            <img src={progression.rankInfo.imageSrc} alt={`${progression.rankLabel} icon`} className='w-20 h-20 object-cover' />
                            <div><p className='text-xs text-neutral1'>Current Rank</p><p className='text-2xl font-semibold'>{progression.rankLabel}</p></div>
                        </div>
                        <div className='flex items-center gap-4 justify-end text-right'>
                            {progression.nextTierThreshold ? <>
                                <div><p className='text-xs text-neutral1'>Next Rank</p><p className='text-2xl font-semibold'>{progression.nextTierLabel}</p></div>
                                <img src={nextRankInfo?.imageSrc} alt={`${progression.nextTierLabel} icon`} className='w-20 h-20 object-cover' />
                            </> : <div><p className='text-xs text-neutral1'>Next Rank</p><p className='text-2xl font-semibold'>Final Rank Reached</p></div>}
                        </div>
                    </div>
                    <div className='flex justify-between text-sm font-semibold'>
                        <p>{Math.max(0, Number(progression.currentTierProgress) || 0)} <span className='text-xs text-neutral1'>SAT</span>{' '}
                            {!isDraw && eloDelta !== 0 ? <span className={eloDelta > 0 ? 'text-sky-400' : 'text-red-400'}>{eloDeltaLabel}</span> : null}
                        </p>
                        <p>{Math.max(1, Number(progression.currentTierSpan) || 1)} <span className='text-xs text-neutral1'>SAT</span></p>
                    </div>
                    <ProgressBar
                        value={Math.max(0, Number(progression.currentTierProgress) || 0)}
                        max={Math.max(1, Number(progression.currentTierSpan) || 1)}
                        secondaryValue={Math.max(0, Number(progression.rankedStats?.peakElo) - Number(progression.currentTierMinElo))}
                        secondaryMax={Math.max(1, Number(progression.currentTierSpan) || 1)}
                        secondaryClassName='bg-sky-300/40'
                    />
                </div>
            </> : null}

            <h2 className='text-2xl font-bold mt-9 mb-6 underline underline-offset-12 decoration-neutral2'>Game Rounds</h2>
            <div className='w-full max-w-4xl flex flex-col gap-3'>
                {gameRounds.map((round) => {
                    const isQuestionRound = round.kind === 'question'
                    const winnerUserIds = Array.isArray(round.data?.winnerUserIds)
                        ? round.data.winnerUserIds
                        : [isQuestionRound ? round.data?.advantageOwnerUserId : round.data?.winnerUserId].filter(Boolean)
                    const roundWinners = players.filter((player) => winnerUserIds.includes(player.userId))
                    const localTeamWinners = roundWinners.filter((player) => areGameTeammates(player, localPlayer))
                    const opposingTeamWinners = roundWinners.filter((player) => !areGameTeammates(player, localPlayer))
                    return (
                        <div key={round.uid} className='w-full flex items-center gap-4'>
                            <div className='w-32 shrink-0 flex justify-end'>
                                <AvatarStack users={localTeamWinners} maxVisible={4} sizeClassName='w-10 h-10' />
                            </div>
                            <Card className='flex-1 min-w-0 gap-1! items-center'>
                                {!isQuestionRound ? <p className='text-sm font-semibold'>Puncture Round {round.punctureRoundNumber}</p> : null}
                                {isQuestionRound ? (
                                    <p className='text-xs text-neutral1'>Correct answer: {round.data?.correctAnswer ?? '—'}</p>
                                ) : (
                                    <p className='text-xs text-neutral1'>
                                        {Number(round.data?.remainingByUserId?.[userId]) || 0}–{Number(round.data?.remainingByUserId?.[opponent?.userId]) || 0} pins left
                                    </p>
                                )}
                            </Card>
                            <div className='w-32 shrink-0 flex justify-start'>
                                <AvatarStack users={opposingTeamWinners} maxVisible={4} sizeClassName='w-10 h-10' />
                            </div>
                        </div>
                    )
                })}
                {!gameRounds.length ? <p className='text-center text-sm text-neutral1'>No rounds found.</p> : null}
            </div>
        </div>
    )
}

const PunctureMatchEnd = ({ snapshot, userId, startedAt }) => {
    const { userStats } = useUserStats()
    const state = snapshot?.room?.state ?? {}
    const players = snapshot?.players ?? EMPTY_PLAYERS
    const localPlayer = players.find((player) => player.userId === userId) ?? null
    const opponent = players.find((player) => player.userId !== userId) ?? null
    const winnerUserId = state.winnerUserId ?? null
    const isWin = winnerUserId === userId
    const endedEvent = [...(snapshot?.events ?? [])].reverse().find((event) => event.type === 'GAME_ENDED')
    const endReason = endedEvent?.data?.endReason ?? null
    const reasonLabel = endReason === 'first_to_three'
        ? (isWin ? 'You won the Puncture match.' : 'Your opponent won the Puncture match.')
        : (endReason === 'max_questions' ? 'Reached max questions' : (endReason === 'player_left'
            ? (isWin ? 'Your opponent left the match.' : 'You left the match.') : null))
    const rounds = buildMatchEndRounds({
        events: snapshot?.events,
        modeId: MODE_ID,
        userId,
        opponentUserId: opponent?.userId,
        reviewQuestionsById: state.reviewQuestionsById,
    })
    const endedAt = Number(endedEvent?.createdAt) || Date.now()
    return <MatchEndOverlay
        winnerUserId={winnerUserId}
        userId={userId}
        modeId={MODE_ID}
        reasonLabel={reasonLabel}
        localPlayer={localPlayer}
        opponent={opponent}
        matchDurationSeconds={Math.max(0, (endedAt - Number(startedAt || endedAt)) / 1000)}
        questionsAnswered={countAnsweredQuestions(rounds)}
        rankedProgression={snapshot?.room?.ranked ? buildMultiplayerUiState({ userStats, modeId: MODE_ID }) : null}
        eloDelta={Number(endedEvent?.data?.eloDeltaByUserId?.[userId]) || 0}
        players={players}
        rounds={rounds}
    />
}

const PunctureGame = ({ roomId, userId }) => {
    const [snapshot, setSnapshot] = useState(null)
    const [response, setResponse] = useState('')
    const [calculatorOpen, setCalculatorOpen] = useState(false)
    const [questionReveal, setQuestionReveal] = useState(null)
    const [now, setNow] = useState(() => getGameServerNow(roomId))
    const [shotLedger, setShotLedger] = useState([])
    const [playbackResetKey, setPlaybackResetKey] = useState(0)
    const shownAnswerToastEventIdsRef = useRef(new Set())
    const lastProcessedAnswerSequenceRef = useRef(null)
    const lastOptimisticShotAtRef = useRef(0)
    const shotLedgerRef = useRef([])
    const predictionInputsRef = useRef(null)
    const shownQuestionRevealEventIdsRef = useRef(new Set())
    const questionsByIdRef = useRef(new Map())
    const { screenShakeRef, shake } = useScreenShake()
    const { showToast } = useToast()
    const serverNow = useCallback(() => getGameServerNow(roomId), [roomId])

    useEffect(() => subscribeToGameSnapshot(roomId, setSnapshot), [roomId])
    useEffect(() => subscribeToGameActionResults(roomId, (result) => {
        setShotLedger((current) => {
            const reconciled = reconcileActionResult(current, result)
            const next = recalculatePendingShots(reconciled, predictionInputsRef.current)
            shotLedgerRef.current = next
            return next.length === current.length && next.every((entry, index) => entry === current[index]) ? current : next
        })
    }), [roomId])
    useEffect(() => subscribeToGameReconnect(roomId, () => {
        shotLedgerRef.current = []
        setShotLedger([])
        setPlaybackResetKey((value) => value + 1)
    }), [roomId])
    useEffect(() => {
        const timer = setInterval(() => setNow(getGameServerNow(roomId)), 50)
        return () => clearInterval(timer)
    }, [roomId])

    const state = snapshot?.room?.state ?? null
    const players = snapshot?.players ?? EMPTY_PLAYERS
    const localPlayer = players.find((player) => player.userId === userId) ?? null
    const opponent = players.find((player) => player.userId !== userId) ?? null
    const currentQuestion = state?.questionsById?.[state?.currentQuestionId] ?? null
    const hasAnswered = Boolean(localPlayer?.state?.answeredQuestionIds?.includes(state?.currentQuestionId))
    const questionCountdownRemainingMs = Math.max(0, Number(state?.currentQuestionActiveAt || 0) - now)
    const questionCountdown = Math.max(0, Math.ceil(questionCountdownRemainingMs / 1000))
    const phase = state?.phase
    const localRecentShots = localPlayer?.state?.punctureRecentShots ?? EMPTY_SHOTS
    const opponentRecentShots = opponent?.state?.punctureRecentShots ?? EMPTY_SHOTS
    const unconfirmedLocalShots = useMemo(
        () => getUnconfirmedShots(shotLedger, localRecentShots),
        [localRecentShots, shotLedger],
    )
    const predictedLocalPlayer = useMemo(
        () => applyShotOverlay(localPlayer, unconfirmedLocalShots),
        [localPlayer, unconfirmedLocalShots],
    )
    const localShotEvents = useMemo(
        () => mergeShotEvents(shotLedger.map((entry) => entry.shot), localRecentShots),
        [localRecentShots, shotLedger],
    )
    const opponentShotEvents = useMemo(() => mergeShotEvents(opponentRecentShots), [opponentRecentShots])
    const effectiveLocalStunnedUntil = Number(predictedLocalPlayer?.state?.stunnedUntil) || 0
    const questionRevealRemainingMs = questionReveal
        ? Math.max(0, questionReveal.durationMs - (now - questionReveal.startedAtMs))
        : 0
    const isQuestionRevealActive = questionRevealRemainingMs > 0

    useEffect(() => {
        if(currentQuestion?.id) questionsByIdRef.current.set(currentQuestion.id, currentQuestion)
    }, [currentQuestion])

    useEffect(() => {
        if(questionReveal && questionRevealRemainingMs <= 0) setQuestionReveal(null)
    }, [questionReveal, questionRevealRemainingMs])

    useEffect(() => {
        setShotLedger((current) => {
            const pruned = pruneConfirmedShots(current, localRecentShots)
            const next = recalculatePendingShots(pruned, predictionInputsRef.current)
            if(next.length === current.length && next.every((entry, index) => entry === current[index])) return current
            shotLedgerRef.current = next
            return next
        })
    }, [localRecentShots])

    useEffect(() => {
        if(!shotLedger.length) return () => {}
        const timer = window.setInterval(() => {
            const cutoff = Date.now() - SHOT_RECEIPT_TIMEOUT_MS
            if(!shotLedgerRef.current.some((entry) => entry.createdAt <= cutoff)) return
            requestGameResync(roomId)
            setShotLedger((current) => {
                const next = current.filter((entry) => entry.createdAt > cutoff)
                shotLedgerRef.current = next
                return next
            })
        }, 250)
        return () => window.clearInterval(timer)
    }, [roomId, shotLedger.length])

    useEffect(() => {
        const events = snapshot?.events ?? []
        if(!events.length || snapshot?.room?.status !== 'active') return
        const answerEvents = events.filter((event) => event?.type === 'ANSWER_SUBMITTED')
        if(!answerEvents.length) return
        if(lastProcessedAnswerSequenceRef.current == null) {
            const latestNonAnswerSequence = events.reduce((latest, event) => {
                if(event?.type === 'ANSWER_SUBMITTED') return latest
                const sequence = Number(event?.sequence)
                return Number.isFinite(sequence) ? Math.max(latest, sequence) : latest
            }, -Infinity)
            lastProcessedAnswerSequenceRef.current = Number.isFinite(latestNonAnswerSequence) ? latestNonAnswerSequence : -Infinity
        }
        const currentSequence = Number(lastProcessedAnswerSequenceRef.current)
        const incoming = answerEvents
            .filter((event) => Number(event?.sequence) > currentSequence)
            .sort((first, second) => Number(first.sequence) - Number(second.sequence))
        if(!incoming.length) return
        let latestSequence = currentSequence
        incoming.forEach((event) => {
            latestSequence = Math.max(latestSequence, Number(event.sequence))
            const questionId = event?.data?.questionId
            if(!event?.uid || !questionId) return
            if(shownAnswerToastEventIdsRef.current.has(event.uid)) return
            const submitter = players.find((player) => player.userId === event.actorUserId)
            shownAnswerToastEventIdsRef.current.add(event.uid)
            showToast({
                component: SatClassicSubmittedToast,
                props: { submitterName: submitter?.displayName || 'A player', profilePicture: submitter?.profilePicture ?? null, avatar: submitter?.avatar ?? null },
                duration: 2_200,
            })
        })
        lastProcessedAnswerSequenceRef.current = latestSequence
    }, [snapshot?.events, snapshot?.room?.status, players, showToast])

    useEffect(() => setResponse(''), [state?.currentQuestionId])
    useEffect(() => {
        const events = snapshot?.events ?? []
        events.forEach((event) => {
            if(event?.type !== 'QUESTION_RESOLVED' || !event?.uid || shownQuestionRevealEventIdsRef.current.has(event.uid)) return
            const questionId = event?.data?.questionId
            const question = questionsByIdRef.current.get(questionId)
            if(!question) return
            const roundResults = Array.isArray(event?.data?.roundResults) ? event.data.roundResults : []
            const myResult = roundResults.find((result) => result?.userId === userId)
            const answerResponses = roundResults.map((result) => ({
                submittedResponse: result?.submittedResponse,
                isCorrect: Boolean(result?.isCorrect),
                player: players.find((player) => player.userId === result?.userId),
            })).filter((entry) => entry.submittedResponse != null && entry.player)
            shownQuestionRevealEventIdsRef.current.add(event.uid)
            setQuestionReveal({
                questionId,
                question,
                questionIndex: state?.questionIndex ?? 0,
                submittedResponse: myResult?.submittedResponse ?? '',
                isCorrect: Boolean(myResult?.isCorrect),
                correctAnswer: event?.data?.correctAnswer ?? null,
                answerResponses,
                startedAtMs: getGameServerNow(roomId),
                durationMs: QUESTION_REVEAL_DURATION_MS,
            })
        })
    }, [snapshot?.events, state?.questionIndex, userId, players, roomId])

    // Read from a ref inside the handler (rather than as effect deps) so the listener doesn't
    // need to be torn down and re-added on every shot/state tick - only phase/room changes do.
    predictionInputsRef.current = {
        stunnedUntil: effectiveLocalStunnedUntil,
        roundIndex: state?.punctureRoundIndex,
        roundStartedAt: state?.punctureRoundStartedAt,
        rotationTurnsPerSecond: state?.rotationTurnsPerSecond,
        generatedPinAngles: state?.generatedPinAngles ?? [],
        attachedPinAngles: localPlayer?.state?.puncturePinAngles ?? [],
        recentShots: localRecentShots,
    }

    useEffect(() => {
        if(phase !== 'puncture_active') return () => {}
        const onKeyDown = (event) => {
            if(event.repeat || ['INPUT', 'TEXTAREA'].includes(event.target?.tagName)) return
            const key = String(event.key).toLowerCase()
            if(key !== 'w' && key !== 'arrowup') return
            event.preventDefault()
            const shotAt = getGameServerNow(roomId)
            const inputs = predictionInputsRef.current
            const unresolved = getUnconfirmedShots(shotLedgerRef.current, inputs.recentShots)
            const ledgerStunnedUntil = unresolved
                .filter((shot) => shot.hit)
                .reduce((latest, shot) => Math.max(latest, Number(shot.shotAt) + STUN_MS), 0)
            if(shotAt < Math.max(inputs.stunnedUntil, ledgerStunnedUntil) || shotAt - lastOptimisticShotAtRef.current < 50) return
            lastOptimisticShotAtRef.current = shotAt
            const clientActionId = `shot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
            const prediction = predictShot({
                shotAt,
                roundStartedAt: inputs.roundStartedAt,
                rotationTurnsPerSecond: inputs.rotationTurnsPerSecond,
                generatedPinAngles: inputs.generatedPinAngles,
                attachedPinAngles: predictionAngles(inputs.attachedPinAngles, unresolved),
            })
            const shot = {
                sequence: null,
                roundIndex: Number(inputs.roundIndex) || 0,
                clientActionId,
                shotAt,
                impactAt: prediction.shotImpactAt,
                hit: prediction.hit,
                attachedAngle: prediction.attachedAngle,
                targetAngle: prediction.targetAngle,
            }
            const nextLedger = appendPendingShot(shotLedgerRef.current, shot, Date.now())
            shotLedgerRef.current = nextLedger
            setShotLedger(nextLedger)
            shake(prediction.hit ? 'impact' : 'subtle')
            sendGameMessage(roomId, 'game.shoot', { clientActionId, shotAt })
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [phase, roomId, shake])

    useEffect(() => {
        if(phase === 'puncture_active') return
        lastOptimisticShotAtRef.current = 0
        shotLedgerRef.current = []
        setShotLedger([])
    }, [phase, state?.punctureRoundIndex])

    const questionRemaining = Math.max(0, Number(state?.currentQuestionDeadlineAt || 0) - now)
    const punctureRemaining = Math.max(0, Number(state?.punctureRoundDeadlineAt || 0) - now)
    const punctureCountdownRemainingMs = Math.max(0, Number(state?.punctureCountdownEndsAt || 0) - Math.max(now, Number(state?.punctureCountdownStartedAt || 0)))
    const countdownRemaining = Math.max(0, Math.ceil(punctureCountdownRemainingMs / 1000))
    if(!state || !localPlayer || !opponent) return <LoadingState className='min-h-[420px]' />
    if(phase === 'finished' || snapshot?.room?.status === 'finished') {
        return <PunctureMatchEnd snapshot={snapshot} userId={userId} startedAt={state.startedAt} />
    }

    const isRoundHold = phase === 'puncture_result' || phase === 'match_result'
    const activeTimer = phase === 'question_active'
        ? (questionCountdown > 0 ? QUESTION_DURATION_MS : Math.floor(questionRemaining / 1000) * 1000)
        : (phase === 'puncture_countdown'
            ? PUNCTURE_ROUND_DURATION_MS
            : (isRoundHold ? Math.max(0, Number(state.lastPunctureResult?.remainingMs) || 0) : punctureRemaining))
    const resolvedWinnerUserId = phase === 'match_result' ? state.matchResultWinnerUserId : state.lastPunctureResult?.winnerUserId

    return (
        <div ref={screenShakeRef} className={`w-full h-full min-h-[420px] flex flex-col will-change-transform ${phase === 'question_active' ? 'gap-12' : 'gap-4'}`}>
            <PunctureHeader localPlayer={localPlayer} opponent={opponent} remainingMs={activeTimer} />

            {phase === 'question_active' || isQuestionRevealActive ? (
                <div className='relative flex-1 flex min-h-0'>
                    <QuestionPane
                        gameState={isQuestionRevealActive ? { ...state, questionIndex: questionReveal.questionIndex } : state}
                        currentQuestion={isQuestionRevealActive ? questionReveal.question : currentQuestion}
                        submittedResponse={isQuestionRevealActive ? questionReveal.submittedResponse : response}
                        isSprQuestion={String((isQuestionRevealActive ? questionReveal.question : currentQuestion)?.questionType).toLowerCase() === 'spr'}
                        isCalculatorOpen={calculatorOpen}
                        onToggleCalculator={() => setCalculatorOpen((value) => !value)}
                        isBusy={isQuestionRevealActive || !currentQuestion || hasAnswered || questionCountdown > 0}
                        hasAnswered={isQuestionRevealActive || hasAnswered}
                        onChoiceSelect={(value) => setResponse(String(value))}
                        onResponseChange={setResponse}
                        onSubmit={() => {
                            const submittedResponse = response.trim()
                            if(submittedResponse && !hasAnswered && questionCountdown <= 0) sendGameMessage(roomId, 'game.answer', { submittedResponse })
                        }}
                        answerReveal={isQuestionRevealActive ? { correctAnswer: questionReveal.correctAnswer, isCorrect: questionReveal.isCorrect, responses: questionReveal.answerResponses } : null}
                    />
                    {questionCountdown > 0 && !isQuestionRevealActive ? (
                        <TransitionOverlay remainingMs={questionCountdownRemainingMs} countdown={questionCountdown} title='Get ready...' />
                    ) : null}
                </div>
            ) : (
                <div className='relative flex-1 min-h-0 flex flex-col md:flex-row justify-center gap-5'>
                    <PunctureBoard
                        player={isRoundHold ? localPlayer : predictedLocalPlayer}
                        gameState={state}
                        isFaded={isRoundHold && Boolean(resolvedWinnerUserId) && resolvedWinnerUserId !== localPlayer.userId}
                        slowdownStartedAt={isRoundHold ? state.punctureRoundResolvedAt : null}
                        now={now}
                        shotEvents={localShotEvents}
                        playbackResetKey={playbackResetKey}
                        serverNow={serverNow}
                    />
                    <PunctureBoard
                        player={opponent}
                        gameState={state}
                        isFaded={isRoundHold && Boolean(resolvedWinnerUserId) && resolvedWinnerUserId !== opponent.userId}
                        slowdownStartedAt={isRoundHold ? state.punctureRoundResolvedAt : null}
                        now={now}
                        shotEvents={opponentShotEvents}
                        playbackResetKey={playbackResetKey}
                        serverNow={serverNow}
                    />
                    {phase === 'puncture_countdown' ? (
                        <TransitionOverlay
                            remainingMs={punctureCountdownRemainingMs}
                            countdown={countdownRemaining}
                            title={state.advantageOwnerUserId
                                ? `${state.advantageOwnerUserId === userId ? 'You have' : `${opponent.displayName} has`} 20% fewer pins`
                                : 'Get ready...'}
                        />
                    ) : null}
                </div>
            )}

            {phase === 'puncture_active' || isRoundHold ? (
                <div className='flex items-center justify-center gap-2 text-sm text-neutral1'>
                    <kbd className='min-w-8 rounded-lg bg-neutral5 px-2 py-1 text-center font-semibold text-neutral1'>W</kbd>
                    <span className='mx-1'>or</span>
                    <kbd className='min-w-8 rounded-lg bg-neutral5 px-2 py-1 text-center font-semibold text-neutral1'>↑</kbd>
                </div>
            ) : null}
            <CalculatorWindow isOpen={calculatorOpen && phase === 'question_active'} onClose={() => setCalculatorOpen(false)} />
        </div>
    )
}

export default PunctureGame
