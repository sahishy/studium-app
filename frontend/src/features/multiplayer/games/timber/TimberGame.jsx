import { useEffect, useRef, useState } from 'react'
import { sendGameMessage, subscribeToGameSnapshot } from '../../services/realtimeSocketService'
import QuestionPane from '../sat-classic/components/QuestionPane'
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
import TimberScene from './components/TimberScene'
import useScreenShake from '../../../../shared/utils/useScreenShake'

const EMPTY_PLAYERS = []
const QUESTION_DURATION_MS = 120_000
const TIMBER_ROUND_DURATION_MS = 60_000
const QUESTION_REVEAL_DURATION_MS = 2000

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

const TimberHeader = ({ localPlayer, opponent, remainingMs }) => {
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
            <div className='flex flex-col items-center justify-center'>
                <p className={`text-2xl font-semibold tabular-nums transform transition-all duration-150 ${isLowTime ? 'text-red-500' : ''} ${isPopping ? 'scale-110' : 'scale-100'}`}>
                    {formatClock(remainingMs)}
                </p>
            </div>
            <ScorePanel player={opponent} align='end' />
        </div>
    )
}

const TimberBoard = ({ player, branches = [], requiredChops = 50, isFaded = false, now, resultAnimation = null, resultAnimationKey = 0 }) => {
    const state = player?.state ?? {}
    const actualChops = Number(state.timberActualChops) || 0
    const progress = Number(state.timberProgress) || 0
    const required = Math.max(1, Number(requiredChops) || 50)
    const stunnedMs = Math.max(0, Number(state.stunnedUntil || 0) - now)
    const side = state.timberSide === 'right' ? 'right' : 'left'
    const progressPercent = Math.max(0, Math.min(100, (progress / required) * 100))

    return (
        <Card className={`relative flex-1 min-w-0 max-w-[34rem] h-full min-h-[480px] overflow-hidden p-0! transition-opacity duration-500 ${isFaded ? 'opacity-35' : 'opacity-100'} ${stunnedMs > 0 ? 'ring-2 ring-red-400' : ''}`}>
            <div className='pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-white via-white/55 to-transparent' />
            <div className='pointer-events-none absolute left-5 top-4 z-20 leading-none' aria-label={`${progress} of ${required} chops`}>
                <span className='block text-7xl font-black tabular-nums text-neutral1/25'>{progress}</span>
                <span
                    aria-hidden='true'
                    className='absolute inset-0 block text-7xl font-black tabular-nums text-sky-400 transition-[clip-path] duration-75 ease-linear'
                    style={{ clipPath: `inset(${100 - progressPercent}% 0 0 0)` }}
                >
                    {progress}
                </span>
            </div>

            <TimberScene
                player={player}
                branches={branches}
                actualChops={actualChops}
                side={side}
                resultAnimation={resultAnimation}
                resultAnimationKey={resultAnimationKey}
            />

            {stunnedMs > 0 ? (
                <div className='pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-red-500/10'>
                    <p className='text-3xl font-bold text-red-400'>STUNNED</p>
                </div>
            ) : null}
        </Card>
    )
}

const TimberTransitionOverlay = ({ remainingMs = 0, countdown = null, title, subtitle = null }) => {
    const progressRatio = Math.max(0, Math.min(1, Number(remainingMs) / 3000))
    return (
        <div className='absolute inset-0 z-30 pb-10 bg-neutral6/60 backdrop-blur-sm flex items-center justify-center'>
            <div className='pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-neutral6 to-transparent' />
            <div className='pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-neutral6 to-transparent' />
            <div className='pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-neutral6 to-transparent' />
            <div className='pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-neutral6 to-transparent' />

            <div className='text-center'>
                {countdown != null ? (
                    <p className='text-6xl font-bold leading-none'>{countdown}</p>
                ) : (
                    <p className='text-4xl font-bold leading-none'>{title}</p>
                )}
                <p className='text-sm text-neutral1 mt-2'>{countdown != null ? title : subtitle}</p>
            </div>

            <div className='absolute left-5 right-5 bottom-4 h-1.5 overflow-hidden'>
                <div
                    className='h-full bg-neutral0 rounded-full transition-all duration-75 ease-linear'
                    style={{ width: `${progressRatio * 100}%` }}
                />
            </div>
        </div>
    )
}

const TimberMatchEnd = ({ snapshot, userId, startedAt }) => {
    const { userStats } = useUserStats()
    const state = snapshot?.room?.state ?? {}
    const players = snapshot?.players ?? EMPTY_PLAYERS
    const winnerUserId = state.winnerUserId ?? null
    const isDraw = !winnerUserId
    const isWin = winnerUserId === userId
    const endedEvent = [...(snapshot?.events ?? [])].reverse().find((event) => event.type === 'GAME_ENDED')
    const eloDelta = Number(endedEvent?.data?.eloDeltaByUserId?.[userId]) || 0
    const progression = buildMultiplayerUiState({ userStats, modeId: 'sat-timber' })
    const nextRankInfo = progression.nextTierThreshold ? getRankInfoFromElo(progression.nextTierThreshold.minElo) : null
    const gameRounds = (snapshot?.events ?? [])
        .filter((event) => event.type === 'QUESTION_RESOLVED' || event.type === 'TIMBER_ROUND_RESOLVED')
        .map((event, index) => ({
            ...event,
            kind: event.type === 'QUESTION_RESOLVED' ? 'question' : 'timber',
            roundNumber: index + 1,
        }))
    const endedAt = Number(endedEvent?.createdAt) || Date.now()
    const localPlayer = players.find((player) => player.userId === userId) ?? null
    const opponent = players.find((player) => player.userId !== userId) ?? null
    const endReason = endedEvent?.data?.endReason ?? null
    const reasonLabel = endReason === 'first_to_three'
        ? (isWin ? 'You won the Timber match.' : 'Your opponent won the Timber match.')
        : (endReason === 'max_questions'
            ? 'Reached max questions'
            : (endReason === 'player_left'
                ? (isWin ? 'Your opponent left the match.' : 'You left the match.')
                : null))
    const hasNextRank = Boolean(progression.nextTierThreshold)
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
                            <div className='min-w-0'>
                                <p className='text-xs text-neutral1'>Current Rank</p>
                                <p className='text-2xl font-semibold truncate'>{progression.rankLabel}</p>
                            </div>
                        </div>
                        <div className='flex items-center gap-4 justify-end text-right'>
                            {hasNextRank ? <>
                                <div className='min-w-0'>
                                    <p className='text-xs text-neutral1'>Next Rank</p>
                                    <p className='text-2xl font-semibold truncate'>{progression.nextTierLabel}</p>
                                </div>
                                <img src={nextRankInfo?.imageSrc} alt={`${progression.nextTierLabel} icon`} className='w-20 h-20 object-cover' />
                            </> : <div><p className='text-xs text-neutral1'>Next Rank</p><p className='text-2xl font-semibold'>Final Rank Reached</p></div>}
                        </div>
                    </div>
                    <div className='flex flex-col gap-2'>
                        <div className='flex justify-between'>
                            <p className='text-sm font-semibold'>
                                {Math.max(0, Number(progression.currentTierProgress) || 0)} <span className='text-xs text-neutral1'>SAT</span>{' '}
                                {!isDraw && eloDelta !== 0 ? <span className={`text-sm ${eloDelta > 0 ? 'text-sky-400' : 'text-red-400'}`}>{eloDeltaLabel}</span> : null}
                            </p>
                            <p className='text-sm font-semibold'>{Math.max(1, Number(progression.currentTierSpan) || 1)} <span className='text-xs text-neutral1'>SAT</span></p>
                        </div>
                        <ProgressBar
                            value={Math.max(0, Number(progression.currentTierProgress) || 0)}
                            max={Math.max(1, Number(progression.currentTierSpan) || 1)}
                            secondaryValue={Math.max(0, Number(progression.rankedStats?.peakElo) - Number(progression.currentTierMinElo))}
                            secondaryMax={Math.max(1, Number(progression.currentTierSpan) || 1)}
                            secondaryClassName='bg-sky-300/40'
                        />
                    </div>
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
                                {!isQuestionRound ? <p className='text-sm font-semibold'>Timber Round {Math.floor(round.roundNumber / 2)}</p> : null}
                                {isQuestionRound ? (
                                    <p className='text-xs text-neutral1'>
                                        Correct answer: {round.data?.correctAnswer ?? '—'}
                                    </p>
                                ) : (
                                    <p className='text-xs text-neutral1'>
                                        {Number(round.data?.progressByUserId?.[userId]) || 0}–{Number(round.data?.progressByUserId?.[opponent?.userId]) || 0} chops
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

const TimberGame = ({ roomId, userId }) => {
    const [snapshot, setSnapshot] = useState(null)
    const [response, setResponse] = useState('')
    const [calculatorOpen, setCalculatorOpen] = useState(false)
    const [questionReveal, setQuestionReveal] = useState(null)
    const [now, setNow] = useState(Date.now())
    const shownAnswerToastEventIdsRef = useRef(new Set())
    const lastProcessedAnswerSequenceRef = useRef(null)
    const previousLocalChopsRef = useRef(null)
    const previousLocalStunnedUntilRef = useRef(null)
    const shownQuestionRevealEventIdsRef = useRef(new Set())
    const questionsByIdRef = useRef(new Map())
    const { screenShakeRef, shake } = useScreenShake()
    const { showToast } = useToast()

    useEffect(() => subscribeToGameSnapshot(roomId, setSnapshot), [roomId])
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 50)
        return () => clearInterval(timer)
    }, [])

    const state = snapshot?.room?.state ?? null
    const players = snapshot?.players ?? EMPTY_PLAYERS
    const localPlayer = players.find((player) => player.userId === userId) ?? null
    const opponent = players.find((player) => player.userId !== userId) ?? null
    const currentQuestion = state?.questionsById?.[state?.currentQuestionId] ?? null
    const hasAnswered = Boolean(localPlayer?.state?.answeredQuestionIds?.includes(state?.currentQuestionId))
    const questionCountdownRemainingMs = Math.max(0, Number(state?.currentQuestionActiveAt || 0) - now)
    const questionCountdown = Math.max(0, Math.ceil(questionCountdownRemainingMs / 1000))
    const phase = state?.phase
    const localActualChops = Number(localPlayer?.state?.timberActualChops) || 0
    const localStunnedUntil = Number(localPlayer?.state?.stunnedUntil) || 0
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
        if(previousLocalChopsRef.current == null) {
            previousLocalChopsRef.current = localActualChops
            return
        }
        if(localActualChops > previousLocalChopsRef.current) shake('subtle')
        previousLocalChopsRef.current = localActualChops
    }, [localActualChops, shake])

    useEffect(() => {
        if(previousLocalStunnedUntilRef.current == null) {
            previousLocalStunnedUntilRef.current = localStunnedUntil
            return
        }
        if(localStunnedUntil > previousLocalStunnedUntilRef.current) shake('impact')
        previousLocalStunnedUntilRef.current = localStunnedUntil
    }, [localStunnedUntil, shake])

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
            lastProcessedAnswerSequenceRef.current = Number.isFinite(latestNonAnswerSequence)
                ? latestNonAnswerSequence
                : -Infinity
        }

        const currentSequence = Number(lastProcessedAnswerSequenceRef.current)
        const incoming = answerEvents
            .filter((event) => Number(event?.sequence) > currentSequence)
            .sort((a, b) => Number(a.sequence) - Number(b.sequence))
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
                props: {
                    submitterName: submitter?.displayName || 'A player',
                    profilePicture: submitter?.profilePicture ?? null,
                    avatar: submitter?.avatar ?? null,
                },
                duration: 2200,
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
                startedAtMs: Date.now(),
                durationMs: QUESTION_REVEAL_DURATION_MS,
            })
        })
    }, [snapshot?.events, state?.questionIndex, userId, players])
    useEffect(() => {
        if(phase !== 'timber_active') return () => {}
        const onKeyDown = (event) => {
            if(event.repeat || ['INPUT', 'TEXTAREA'].includes(event.target?.tagName)) return
            const key = String(event.key).toLowerCase()
            const side = key === 'a' || key === 'arrowleft' ? 'left' : (key === 'd' || key === 'arrowright' ? 'right' : null)
            if(!side) return
            event.preventDefault()
            sendGameMessage(roomId, 'game.chop', { side })
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [phase, roomId])

    const questionRemaining = Math.max(0, Number(state?.currentQuestionDeadlineAt || 0) - now)
    const timberRemaining = Math.max(0, Number(state?.timberRoundDeadlineAt || 0) - now)
    const timberCountdownRemainingMs = Math.max(0, Number(state?.timberCountdownEndsAt || 0) - Math.max(now, Number(state?.timberCountdownStartedAt || 0)))
    const countdownRemaining = Math.max(0, Math.ceil(timberCountdownRemainingMs / 1000))
    if(!state || !localPlayer || !opponent) return <LoadingState className='min-h-[420px]' />
    if(phase === 'finished') return <TimberMatchEnd snapshot={snapshot} userId={userId} startedAt={state.startedAt} />

    const isRoundHold = phase === 'timber_result' || phase === 'match_result'
    const activeTimer = phase === 'question_active'
        ? (questionCountdown > 0 ? QUESTION_DURATION_MS : Math.floor(questionRemaining / 1000) * 1000)
        : (phase === 'timber_countdown'
            ? TIMBER_ROUND_DURATION_MS
            : (isRoundHold ? Math.max(0, Number(state.lastTimberResult?.remainingMs) || 0) : timberRemaining))
    const resolvedWinnerUserId = phase === 'match_result'
        ? state.matchResultWinnerUserId
        : state.lastTimberResult?.winnerUserId

    return (
        <div ref={screenShakeRef} className={`w-full h-full min-h-[420px] flex flex-col will-change-transform ${phase === 'question_active' ? 'gap-12' : 'gap-4'}`}>
            <TimberHeader
                localPlayer={localPlayer}
                opponent={opponent}
                remainingMs={activeTimer}
            />

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
                        answerReveal={isQuestionRevealActive ? {
                            correctAnswer: questionReveal.correctAnswer,
                            isCorrect: questionReveal.isCorrect,
                            responses: questionReveal.answerResponses,
                        } : null}
                    />
                    {questionCountdown > 0 && !isQuestionRevealActive ? (
                        <TimberTransitionOverlay
                            remainingMs={questionCountdownRemainingMs}
                            countdown={questionCountdown}
                            title='Get ready...'
                        />
                    ) : null}
                </div>
            ) : (
                <div className='relative flex-1 min-h-0 flex justify-center gap-5'>
                    <TimberBoard
                        player={localPlayer}
                        branches={state.visibleBranchesByUserId?.[localPlayer.userId] ?? []}
                        requiredChops={state.requiredChops}
                        isFaded={isRoundHold && Boolean(resolvedWinnerUserId) && resolvedWinnerUserId !== localPlayer.userId}
                        now={now}
                        resultAnimation={isRoundHold && resolvedWinnerUserId ? (resolvedWinnerUserId === localPlayer.userId ? 'Victory' : 'Defeat') : null}
                        resultAnimationKey={state.timberRoundIndex}
                    />
                    <TimberBoard
                        player={opponent}
                        branches={state.visibleBranchesByUserId?.[opponent.userId] ?? []}
                        requiredChops={state.requiredChops}
                        isFaded={isRoundHold && Boolean(resolvedWinnerUserId) && resolvedWinnerUserId !== opponent.userId}
                        now={now}
                        resultAnimation={isRoundHold && resolvedWinnerUserId ? (resolvedWinnerUserId === opponent.userId ? 'Victory' : 'Defeat') : null}
                        resultAnimationKey={state.timberRoundIndex}
                    />

                    {phase === 'timber_countdown' ? (
                        <TimberTransitionOverlay
                            remainingMs={timberCountdownRemainingMs}
                            countdown={countdownRemaining}
                            title={state.advantageOwnerUserId
                                ? `${state.advantageOwnerUserId === userId ? 'You have' : `${opponent.displayName} has`} a +10 head start`
                                : 'Get ready...'}
                        />
                    ) : null}

                </div>
            )}

            {phase === 'timber_active' || isRoundHold ? (
                <div className='flex items-center justify-center gap-2 text-sm text-neutral1'>
                    <kbd className='min-w-8 rounded-lg bg-neutral5 px-2 py-1 text-center font-semibold text-neutral1'>A</kbd>
                    <kbd className='min-w-8 rounded-lg bg-neutral5 px-2 py-1 text-center font-semibold text-neutral1'>D</kbd>
                    <span className='mx-1'>or</span>
                    <kbd className='min-w-8 rounded-lg bg-neutral5 px-2 py-1 text-center font-semibold text-neutral1'>←</kbd>
                    <kbd className='min-w-8 rounded-lg bg-neutral5 px-2 py-1 text-center font-semibold text-neutral1'>→</kbd>
                </div>
            ) : null}
            <CalculatorWindow isOpen={calculatorOpen && phase === 'question_active'} onClose={() => setCalculatorOpen(false)} />
        </div>
    )
}

export default TimberGame
