import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getGameServerNow, sendGameMessage, subscribeToGameReconnect, subscribeToGameSnapshot } from '../../services/realtimeSocketService'
import QuestionPane from '../sat-classic/components/QuestionPane'
import MatchEndOverlay from '../sat-classic/components/MatchEndOverlay'
import { buildMatchEndRounds, countAnsweredQuestions } from '../sat-classic/utils/matchEndUtils'
import CalculatorWindow from '../../components/windows/CalculatorWindow'
import LoadingState from '../../../../shared/components/ui/LoadingState'
import ProgressBar from '../../../../shared/components/ui/ProgressBar'
import Card from '../../../../shared/components/ui/Card'
import AvatarPicture from '../../../../shared/components/avatar/AvatarPicture'
import AvatarStack from '../../../../shared/components/avatar/AvatarStack'
import SatClassicSubmittedToast from '../sat-classic/components/toasts/SatClassicSubmittedToast'
import { areGameTeammates, buildMultiplayerUiState } from '../../utils/multiplayerUtils'
import { useUserStats } from '../../../profile/contexts/UserStatsContext'
import { getRankInfoFromElo } from '../../../profile/utils/statsUtils'
import { useToast } from '../../../../shared/contexts/ToastContext'
import useScreenShake from '../../../../shared/utils/useScreenShake'
import FlutterScene from './components/FlutterScene'

const MODE_ID = 'sat-flutter'
const EMPTY_PLAYERS = []
const EMPTY_RINGS = []
const EMPTY_FALLING_USER_IDS = []
const EMPTY_INPUT = { up: false, down: false, left: false, right: false }
const QUESTION_DURATION_MS = 120_000
const QUESTION_REVEAL_DURATION_MS = 2_000
// An input the server never acknowledged (it only accepts them during flutter_active) would
// otherwise be replayed by the scene's extrapolation forever. The buffer is also cleared outright
// on every phase change, so this only catches strays inside a single flight.
const MAX_PENDING_INPUT_AGE_MS = 2_000

const formatClock = (milliseconds = 0) => {
    const secondsTotal = Math.max(0, Math.ceil((Number(milliseconds) || 0) / 1000))
    return `${Math.floor(secondsTotal / 60)}:${String(secondsTotal % 60).padStart(2, '0')}`
}

const ScorePanel = ({ player, align = 'start' }) => {
    const end = align === 'end'
    return (
        <div className={`flex-1 max-w-xs ${end ? 'items-end' : ''}`}>
            <div className={`flex items-center gap-3 ${end ? 'flex-row-reverse' : ''}`}>
                <AvatarPicture profile={{ profile: { profilePicture: player?.profilePicture ?? null } }} avatar={player?.avatar} className='w-12 h-12' />
                <div className={`min-w-0 ${end ? 'text-right' : ''}`}>
                    <p className='text-sm truncate'>{player?.displayName || 'Waiting...'}</p>
                    <p className='text-2xl font-semibold tabular-nums'>{Number(player?.state?.score) || 0}</p>
                </div>
            </div>
        </div>
    )
}

const FlutterHeader = ({ localPlayer, opponent, phase, questionRemaining, ringIndex }) => {
    const seconds = Math.max(0, Math.ceil((Number(questionRemaining) || 0) / 1000))
    const [isPopping, setIsPopping] = useState(false)
    const previousSecondRef = useRef(seconds)
    const popTimeoutRef = useRef(null)
    const isQuestion = phase === 'question_active'
    const isFlightCounterVisible = phase === 'flutter_active' || phase === 'flutter_result' || phase === 'match_result'
    const isLowTime = isQuestion && seconds <= 15
    const numericRingIndex = Number(ringIndex)
    const ringCount = Number.isFinite(numericRingIndex) ? Math.max(0, numericRingIndex) : 0

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
            <div className='shrink-0 min-w-28 text-center'>
                {isQuestion ? (
                    <p className={`text-2xl font-semibold tabular-nums transform transition-all duration-150 ${isLowTime ? 'text-red-500' : ''} ${isPopping ? 'scale-110' : 'scale-100'}`}>
                        {formatClock(questionRemaining)}
                    </p>
                ) : isFlightCounterVisible ? (
                    <p className='text-4xl font-bold tabular-nums leading-none'>{ringCount}</p>
                ) : null}
            </div>
            <ScorePanel player={opponent} align='end' />
        </div>
    )
}

const TransitionOverlay = ({ remainingMs = 0, countdown = null, title, subtitle = null }) => {
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

const LegacyFlutterMatchEnd = ({ snapshot, userId, startedAt }) => {
    const { userStats } = useUserStats()
    const state = snapshot?.room?.state ?? {}
    const players = snapshot?.players ?? EMPTY_PLAYERS
    const localPlayer = players.find((player) => player.userId === userId) ?? null
    const opponent = players.find((player) => player.userId !== userId) ?? null
    const winnerUserId = state.winnerUserId ?? null
    const isWin = winnerUserId === userId
    const endedEvent = [...(snapshot?.events ?? [])].reverse().find((event) => event.type === 'GAME_ENDED')
    const eloDelta = Number(endedEvent?.data?.eloDeltaByUserId?.[userId]) || 0
    const progression = buildMultiplayerUiState({ userStats, modeId: MODE_ID })
    const nextRankInfo = progression.nextTierThreshold ? getRankInfoFromElo(progression.nextTierThreshold.minElo) : null
    const endedAt = Number(endedEvent?.createdAt) || Date.now()
    const rounds = (snapshot?.events ?? []).filter((event) => event.type === 'FLUTTER_ROUND_RESOLVED')
    const endReason = endedEvent?.data?.endReason
    const reason = endReason === 'player_left'
        ? (isWin ? 'Your opponent left the match.' : 'You left the match.')
        : (isWin ? 'You won the Flutter match.' : 'Your opponent won the Flutter match.')

    return (
        <div className='w-full h-full min-h-[420px] flex flex-col items-center px-6 py-10 overflow-y-auto'>
            <div className='text-center mb-8'>
                <p className={`text-5xl font-bold ${isWin ? 'text-sat0' : 'text-red-400'} leading-none mb-2`}>{isWin ? 'Victory' : 'Defeat'}</p>
                <p className='text-sm text-neutral1'>{reason}</p>
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
                            {eloDelta !== 0 ? <span className={eloDelta > 0 ? 'text-sky-400' : 'text-red-400'}>{eloDelta > 0 ? `+${eloDelta}` : eloDelta}</span> : null}
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
                {rounds.map((round, index) => {
                    const winnerUserIds = Array.isArray(round.data?.winnerUserIds)
                        ? round.data.winnerUserIds
                        : [round.data?.winnerUserId].filter(Boolean)
                    const winners = players.filter((player) => winnerUserIds.includes(player.userId))
                    const localTeamWinners = winners.filter((player) => areGameTeammates(player, localPlayer))
                    const opposingTeamWinners = winners.filter((player) => !areGameTeammates(player, localPlayer))
                    const localRings = Number(round.data?.ringsClearedByUserId?.[userId]) || 0
                    const opponentRings = Number(round.data?.ringsClearedByUserId?.[opponent?.userId]) || 0
                    return (
                        <div key={round.uid} className='w-full flex items-center gap-4'>
                            <div className='w-32 shrink-0 flex justify-end'>
                                <AvatarStack users={localTeamWinners} maxVisible={4} sizeClassName='w-10 h-10' />
                            </div>
                            <Card className='flex-1 min-w-0 gap-1! items-center'>
                                <p className='text-sm font-semibold'>Flight {index + 1}{round.data?.winnerUserId ? '' : ' · Retry'}</p>
                                <p className='text-xs text-neutral1'>{localRings}–{opponentRings} rings cleared{winners.length ? '' : ' · Simultaneous miss'}</p>
                            </Card>
                            <div className='w-32 shrink-0 flex justify-start'>
                                <AvatarStack users={opposingTeamWinners} maxVisible={4} sizeClassName='w-10 h-10' />
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

const FlutterMatchEnd = ({ snapshot, userId, startedAt }) => {
    const { userStats } = useUserStats()
    const state = snapshot?.room?.state ?? {}
    const players = snapshot?.players ?? EMPTY_PLAYERS
    const localPlayer = players.find((player) => player.userId === userId) ?? null
    const opponent = players.find((player) => player.userId !== userId) ?? null
    const winnerUserId = state.winnerUserId ?? null
    const isWin = winnerUserId === userId
    const endedEvent = [...(snapshot?.events ?? [])].reverse().find((event) => event.type === 'GAME_ENDED')
    const endReason = endedEvent?.data?.endReason ?? null
    const reasonLabel = endReason === 'player_left'
        ? (isWin ? 'Your opponent left the match.' : 'You left the match.')
        : (!winnerUserId ? 'The Flutter match ended in a draw.' : (isWin ? 'You won the Flutter match.' : 'Your opponent won the Flutter match.'))
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

const keyDirection = (key) => {
    const normalized = String(key).toLowerCase()
    if(normalized === 'w' || normalized === 'arrowup') return 'up'
    if(normalized === 's' || normalized === 'arrowdown') return 'down'
    if(normalized === 'a' || normalized === 'arrowleft') return 'left'
    if(normalized === 'd' || normalized === 'arrowright') return 'right'
    return null
}

const FlutterGame = ({ roomId, userId }) => {
    const [snapshot, setSnapshot] = useState(null)
    const [response, setResponse] = useState('')
    const [calculatorOpen, setCalculatorOpen] = useState(false)
    const [questionReveal, setQuestionReveal] = useState(null)
    const [now, setNow] = useState(() => getGameServerNow(roomId))
    const inputRef = useRef(EMPTY_INPUT)
    const inputSequenceRef = useRef(0)
    // Local inputs the server has not acknowledged yet, in send order and stamped on the synced
    // clock (which is what the engine's latency compensation resolves them back to). A ref, not
    // state: the scene reads it every frame in useFrame, and turning each keypress into a React
    // render would reconcile the whole 3D tree for nothing.
    const pendingInputsRef = useRef([])
    const shownAnswerEventsRef = useRef(new Set())
    const shownQuestionRevealEventsRef = useRef(new Set())
    const shownShieldEventsRef = useRef(new Set())
    const shownCollisionEventsRef = useRef(new Set())
    const questionsByIdRef = useRef(new Map())
    const lastProcessedAnswerSequenceRef = useRef(null)
    const { screenShakeRef, shake } = useScreenShake()
    const { showToast } = useToast()
    const serverNow = useCallback(() => getGameServerNow(roomId), [roomId])

    useEffect(() => subscribeToGameSnapshot(roomId, setSnapshot), [roomId])

    const state = snapshot?.room?.state ?? null
    const players = snapshot?.players ?? EMPTY_PLAYERS
    const localPlayer = players.find((player) => player.userId === userId) ?? null
    const opponent = players.find((player) => player.userId !== userId) ?? null
    const phase = state?.phase
    const currentQuestion = state?.questionsById?.[state?.currentQuestionId] ?? null
    const hasAnswered = Boolean(localPlayer?.state?.answeredQuestionIds?.includes(state?.currentQuestionId))
    const questionCountdownRemainingMs = Math.max(0, Number(state?.currentQuestionActiveAt || 0) - now)
    const questionCountdown = Math.max(0, Math.ceil(questionCountdownRemainingMs / 1000))
    const questionRemaining = Math.max(0, Number(state?.currentQuestionDeadlineAt || 0) - now)
    const countdownRemainingMs = Math.max(0, Number(state?.flutterCountdownEndsAt || 0) - Math.max(now, Number(state?.flutterCountdownStartedAt || 0)))
    const countdown = Math.max(0, Math.ceil(countdownRemainingMs / 1000))
    const questionRevealRemainingMs = questionReveal ? Math.max(0, questionReveal.durationMs - (now - questionReveal.startedAtMs)) : 0
    const isQuestionRevealActive = questionRevealRemainingMs > 0

    // Paused during flight: nothing rendered in that phase is derived from this clock (the scene
    // reads the synced clock directly, per frame), so ticking it there would only re-render this
    // component 20 times a second for no visible change.
    useEffect(() => {
        if(phase === 'flutter_active') return () => {}
        const timer = setInterval(() => setNow(getGameServerNow(roomId)), 50)
        return () => clearInterval(timer)
    }, [phase, roomId])

    useEffect(() => {
        if(currentQuestion?.id) questionsByIdRef.current.set(currentQuestion.id, currentQuestion)
    }, [currentQuestion])
    useEffect(() => {
        if(questionReveal && questionRevealRemainingMs <= 0) setQuestionReveal(null)
    }, [questionReveal, questionRevealRemainingMs])
    useEffect(() => setResponse(''), [state?.currentQuestionId])

    useEffect(() => {
        const events = snapshot?.events ?? []
        if(!events.length || snapshot?.room?.status !== 'active') return
        const answers = events.filter((event) => event?.type === 'ANSWER_SUBMITTED')
        if(lastProcessedAnswerSequenceRef.current == null) {
            const latestNonAnswer = events.reduce((latest, event) => event?.type === 'ANSWER_SUBMITTED' ? latest : Math.max(latest, Number(event?.sequence) || -Infinity), -Infinity)
            lastProcessedAnswerSequenceRef.current = latestNonAnswer
        }
        const incoming = answers.filter((event) => Number(event?.sequence) > Number(lastProcessedAnswerSequenceRef.current)).sort((a, b) => Number(a.sequence) - Number(b.sequence))
        incoming.forEach((event) => {
            if(shownAnswerEventsRef.current.has(event.uid)) return
            shownAnswerEventsRef.current.add(event.uid)
            const submitter = players.find((player) => player.userId === event.actorUserId)
            showToast({ component: SatClassicSubmittedToast, props: { submitterName: submitter?.displayName || 'A player', profilePicture: submitter?.profilePicture ?? null, avatar: submitter?.avatar ?? null }, duration: 2200 })
        })
        if(incoming.length) lastProcessedAnswerSequenceRef.current = Number(incoming[incoming.length - 1].sequence)
    }, [players, showToast, snapshot?.events, snapshot?.room?.status])

    useEffect(() => {
        const events = snapshot?.events ?? []
        events.forEach((event) => {
            if(event?.type === 'QUESTION_RESOLVED' && event?.uid && !shownQuestionRevealEventsRef.current.has(event.uid)) {
                const question = questionsByIdRef.current.get(event.data?.questionId)
                if(!question) return
                const roundResults = Array.isArray(event.data?.roundResults) ? event.data.roundResults : []
                const myResult = roundResults.find((result) => result?.userId === userId)
                const answerResponses = roundResults.map((result) => ({ submittedResponse: result?.submittedResponse, isCorrect: Boolean(result?.isCorrect), player: players.find((player) => player.userId === result?.userId) })).filter((entry) => entry.submittedResponse != null && entry.player)
                shownQuestionRevealEventsRef.current.add(event.uid)
                setQuestionReveal({ question, questionIndex: state?.questionIndex ?? 0, submittedResponse: myResult?.submittedResponse ?? '', isCorrect: Boolean(myResult?.isCorrect), correctAnswer: event.data?.correctAnswer ?? null, answerResponses, startedAtMs: getGameServerNow(roomId), durationMs: QUESTION_REVEAL_DURATION_MS })
            }
            if(event?.type === 'FLUTTER_SHIELD_CONSUMED' && event?.uid && event.actorUserId === userId && !shownShieldEventsRef.current.has(event.uid)) {
                shownShieldEventsRef.current.add(event.uid)
                shake('impact')
            }
            if(event?.type === 'FLUTTER_ROUND_RESOLVED' && event?.uid && !shownCollisionEventsRef.current.has(event.uid)) {
                shownCollisionEventsRef.current.add(event.uid)
                const winnerUserId = event.data?.winnerUserId ?? null
                if(!winnerUserId || winnerUserId !== userId) shake('impact')
            }
        })
    }, [players, roomId, shake, snapshot?.events, state?.questionIndex, userId])

    const sendInput = useCallback((next) => {
        inputSequenceRef.current += 1
        const sequence = inputSequenceRef.current
        const at = getGameServerNow(roomId)
        pendingInputsRef.current = [
            ...pendingInputsRef.current.filter((entry) => at - entry.at <= MAX_PENDING_INPUT_AGE_MS),
            { sequence, at, input: next },
        ]
        sendGameMessage(roomId, 'game.flutterInput', { sequence, ...next })
    }, [roomId])

    // An acknowledged input is baked into the authoritative position the server just published,
    // so replaying it on top of that position would double-apply it.
    useEffect(() => {
        const serverSequence = Number(localPlayer?.state?.flutterInputSequence)
        if(!Number.isSafeInteger(serverSequence)) return
        inputSequenceRef.current = Math.max(inputSequenceRef.current, serverSequence)
        pendingInputsRef.current = pendingInputsRef.current.filter((entry) => entry.sequence > serverSequence)
    }, [localPlayer?.state?.flutterInputSequence])

    useEffect(() => {
        if(phase !== 'flutter_active') {
            inputRef.current = EMPTY_INPUT
            // The engine resets every player's flight state at each round boundary, so nothing
            // queued against the previous round may be replayed into the next one.
            pendingInputsRef.current = []
            return () => {}
        }
        const pressed = new Set()
        const update = () => {
            const next = { up: pressed.has('up'), down: pressed.has('down'), left: pressed.has('left'), right: pressed.has('right') }
            inputRef.current = next
            sendInput(next)
        }
        const onKeyDown = (event) => {
            if(['INPUT', 'TEXTAREA'].includes(event.target?.tagName)) return
            const direction = keyDirection(event.key)
            if(!direction) return
            event.preventDefault()
            if(!pressed.has(direction)) { pressed.add(direction); update() }
        }
        const onKeyUp = (event) => {
            const direction = keyDirection(event.key)
            if(!direction) return
            event.preventDefault()
            if(pressed.delete(direction)) update()
        }
        const onBlur = () => { if(pressed.size) { pressed.clear(); update() } }
        const onVisibilityChange = () => { if(document.hidden) onBlur() }
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        window.addEventListener('blur', onBlur)
        document.addEventListener('visibilitychange', onVisibilityChange)
        update()
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
            window.removeEventListener('blur', onBlur)
            document.removeEventListener('visibilitychange', onVisibilityChange)
        }
    }, [phase, sendInput])

    useEffect(() => subscribeToGameReconnect(roomId, () => {
        if(phase === 'flutter_active') sendInput(inputRef.current)
    }), [phase, roomId, sendInput])

    const isResult = phase === 'flutter_result' || phase === 'match_result'
    const resultWinnerUserId = phase === 'match_result' ? state?.matchResultWinnerUserId : state?.lastFlutterResult?.winnerUserId
    // Memoised, and derived above the early returns so it can be: a fresh array identity on every
    // render would defeat FlutterScene's memo and reconcile the 3D tree on each HUD clock tick.
    const fallingUserIds = useMemo(() => (isResult
        ? players.filter((player) => !resultWinnerUserId || player.userId !== resultWinnerUserId).map((player) => player.userId)
        : EMPTY_FALLING_USER_IDS), [isResult, players, resultWinnerUserId])

    if(!state || !localPlayer || !opponent) return <LoadingState className='min-h-[420px]' />
    if(phase === 'finished' || snapshot?.room?.status === 'finished') return <FlutterMatchEnd snapshot={snapshot} userId={userId} startedAt={state.startedAt} />

    return (
        <div ref={screenShakeRef} className={`w-full h-full min-h-[420px] flex flex-col will-change-transform ${phase === 'question_active' ? 'gap-12' : 'gap-4'}`}>
            <FlutterHeader localPlayer={localPlayer} opponent={opponent} phase={phase} questionRemaining={questionCountdown > 0 ? QUESTION_DURATION_MS : Math.floor(questionRemaining / 1000) * 1000} ringIndex={state.flutterRingIndex} />

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
                    {questionCountdown > 0 && !isQuestionRevealActive ? <TransitionOverlay remainingMs={questionCountdownRemainingMs} countdown={questionCountdown} title='Get ready...' /> : null}
                </div>
            ) : (
                <Card className='relative flex-1 min-h-[460px] overflow-hidden p-0!'>
                    <FlutterScene
                        localPlayer={localPlayer}
                        opponent={opponent}
                        rings={state.visibleFlutterRings ?? EMPTY_RINGS}
                        pendingInputsRef={pendingInputsRef}
                        resultWinnerUserId={isResult ? resultWinnerUserId : null}
                        fallingUserIds={fallingUserIds}
                        slowdownStartedAt={isResult ? state.flutterRoundResolvedAt : null}
                        animationKey={`${state.flutterRoundIndex}-${state.flutterAttempt}`}
                        serverNow={serverNow}
                    />
                    {phase === 'flutter_countdown' ? (
                        <TransitionOverlay
                            remainingMs={countdownRemainingMs}
                            countdown={countdown}
                            title={state.advantageOwnerUserId ? `${state.advantageOwnerUserId === userId ? 'You have' : `${opponent.displayName} has`} a one-use shield` : 'Get ready...'}
                        />
                    ) : null}
                </Card>
            )}

            {phase === 'flutter_active' || isResult ? (
                <div className='flex items-center justify-center gap-2 text-sm text-neutral1'>
                    {['W', 'A', 'S', 'D'].map((key) => <kbd key={key} className='min-w-8 rounded-lg bg-neutral5 px-2 py-1 text-center font-semibold text-neutral1'>{key}</kbd>)}
                    <span className='mx-1'>or</span>
                    {['↑', '←', '↓', '→'].map((key) => <kbd key={key} className='min-w-8 rounded-lg bg-neutral5 px-2 py-1 text-center font-semibold text-neutral1'>{key}</kbd>)}
                </div>
            ) : null}
            <CalculatorWindow isOpen={calculatorOpen && phase === 'question_active'} onClose={() => setCalculatorOpen(false)} />
        </div>
    )
}

export default FlutterGame
