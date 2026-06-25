import { useEffect, useMemo, useState } from 'react'
import LoadingState from '../../../../shared/components/ui/LoadingState'
import ErrorState from '../../../../shared/components/ui/ErrorState'
import { formatDurationMmSsMs } from '../../../../shared/utils/formatters'
import CalculatorWindow from '../../components/windows/CalculatorWindow'
import SingleplayerGameEndOverlay from '../components/SingleplayerGameEndOverlay'
import SingleplayerQuestionResultOverlay, { OVERLAY_DURATION_MS, WRONG_ANSWER_PENALTY_MS } from '../components/SingleplayerQuestionResultOverlay'
import QuestionPane from '../sat-classic/components/QuestionPane'
import { getQuestions } from '../../services/questionService'
import { applySingleplayerGameResult } from '../../../profile/services/statsService'

const MODE_ID = 'blitz'

const BlitzGame = ({ userId }) => {

    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [questionIndex, setQuestionIndex] = useState(0)
    const [submittedResponse, setSubmittedResponse] = useState('')
    const [submittedAnswers, setSubmittedAnswers] = useState([])
    const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)
    const [startedAtMs, setStartedAtMs] = useState(null)
    const [nowMs, setNowMs] = useState(Date.now())
    const [hasSavedResult, setHasSavedResult] = useState(false)
    const [bestTimeMs, setBestTimeMs] = useState(null)
    const [isPenaltyFlashing, setIsPenaltyFlashing] = useState(false)
    const [penaltyMs, setPenaltyMs] = useState(0)
    const [frozenElapsedMs, setFrozenElapsedMs] = useState(0)
    const [finalScoreMs, setFinalScoreMs] = useState(null)
    const [resultOverlay, setResultOverlay] = useState({
        mode: 'start',
        startedAtMs: Date.now(),
        isLastQuestion: false,
    })

    useEffect(() => {
        let isMounted = true

        const loadQuestions = async () => {
            try {
                setLoading(true)
                const nextQuestions = await getQuestions({ count: 10 })

                if(!isMounted) {
                    return
                }

                setQuestions(Array.isArray(nextQuestions) ? nextQuestions : [])
                setStartedAtMs(null)
                setError(null)
            } catch (loadError) {
                if(isMounted) {
                    setError(loadError)
                }
            } finally {
                if(isMounted) {
                    setLoading(false)
                }
            }
        }

        void loadQuestions()

        return () => {
            isMounted = false
        }
    }, [])

    useEffect(() => {
        const intervalId = setInterval(() => setNowMs(Date.now()), 10)
        return () => clearInterval(intervalId)
    }, [])

    useEffect(() => {
        setSubmittedResponse('')
    }, [questionIndex])

    const currentQuestion = questions[questionIndex] ?? null
    const isFinished = questions.length > 0 && questionIndex >= questions.length
    const isSprQuestion = String(currentQuestion?.questionType ?? '').toLowerCase() === 'spr'
    const isResultOverlayActive = Boolean(resultOverlay)
    const rawElapsedMs = startedAtMs ? Math.max(0, nowMs - startedAtMs) : 0
    const activeElapsedMs = isFinished
        ? (finalScoreMs ?? frozenElapsedMs)
        : (isResultOverlayActive ? frozenElapsedMs : rawElapsedMs)
    const score = activeElapsedMs + penaltyMs
    const reviewItems = useMemo(() => submittedAnswers.map((answerEntry, index) => ({
        id: answerEntry.questionId ?? `${index}`,
        title: `Question ${index + 1}`,
        detailRows: [
            { label: 'Your Answer', value: answerEntry.submittedResponse || '—' },
            { label: 'Correct Answer', value: answerEntry.correctAnswer || '—' },
        ],
        resultLabel: answerEntry.isCorrect ? 'Correct' : 'Incorrect',
        resultClassName: answerEntry.isCorrect ? 'text-sat0' : 'text-red-400',
    })), [submittedAnswers])

    useEffect(() => {
        if(!resultOverlay) {
            return
        }

        const timeoutId = setTimeout(() => {
            const shouldFinish = resultOverlay.isLastQuestion
            const isStartOverlay = resultOverlay.mode === 'start'
            setResultOverlay(null)

            if(isStartOverlay) {
                setStartedAtMs(Date.now())
                return
            }

            if(shouldFinish) {
                setQuestionIndex(questions.length)
                return
            }

            setQuestionIndex((previous) => previous + 1)
        }, OVERLAY_DURATION_MS)

        return () => clearTimeout(timeoutId)
    }, [resultOverlay, questions.length])

    useEffect(() => {
        if(!isFinished || hasSavedResult || !userId) {
            return
        }

        let isMounted = true

        void applySingleplayerGameResult({
            userId,
            modeId: MODE_ID,
            score,
        }).finally(() => {
            if(isMounted) {
                setBestTimeMs((previous) => {
                    if(previous == null || previous <= 0) {
                        return score
                    }

                    return Math.min(previous, score)
                })
                setHasSavedResult(true)
            }
        })

        return () => {
            isMounted = false
        }
    }, [isFinished, hasSavedResult, userId, score])

    const handleSubmit = () => {
        if(!currentQuestion || isResultOverlayActive) {
            return
        }

        const normalizedResponse = String(submittedResponse ?? '').trim()
        if(!normalizedResponse) {
            return
        }

        const comparableResponse = normalizedResponse.toLowerCase().replace(/\s+/g, '')
        const isCorrect = isSprQuestion
            ? (currentQuestion.acceptableAnswersComparable ?? []).includes(comparableResponse)
            : normalizedResponse.toUpperCase() === currentQuestion.correctAnswer

        const penaltyToApply = isCorrect ? 0 : WRONG_ANSWER_PENALTY_MS
        const nextFrozenElapsedMs = rawElapsedMs
        const nextPenaltyMs = penaltyMs + penaltyToApply
        const isLastQuestion = questionIndex >= questions.length - 1

        setSubmittedAnswers((previous) => ([
            ...previous,
            {
                questionId: currentQuestion.id,
                submittedResponse: normalizedResponse,
                correctAnswer: currentQuestion.correctAnswerDisplay ?? currentQuestion.correctAnswer,
                isCorrect,
            },
        ]))
        setFrozenElapsedMs(nextFrozenElapsedMs)
        setPenaltyMs(nextPenaltyMs)

        if(penaltyToApply > 0) {
            setIsPenaltyFlashing(true)
            window.setTimeout(() => {
                setIsPenaltyFlashing(false)
            }, 300)
        }

        if(isLastQuestion) {
            setFinalScoreMs(nextFrozenElapsedMs + nextPenaltyMs)
        }

        setResultOverlay({
            mode: 'question_result',
            startedAtMs: Date.now(),
            isCorrect,
            correctAnswer: currentQuestion.correctAnswerDisplay ?? currentQuestion.correctAnswer,
            penaltyMs: penaltyToApply,
            isLastQuestion,
        })
    }

    if(loading) {
        return <LoadingState className='min-h-[420px]' />
    }

    if(error || (!currentQuestion && !isFinished)) {
        return (
            <ErrorState
                title='Unable to start Blitz'
                description={error?.message || 'We could not load questions for this run.'}
            />
        )
    }

    if(isFinished) {
        return (
            <SingleplayerGameEndOverlay
                title='Blitz Complete'
                subtitle='You finished all 10 questions.'
                scoreLabel='New Score'
                scoreDisplay={formatDurationMmSsMs(finalScoreMs ?? score)}
                bestScoreLabel='Best Score'
                bestScoreDisplay={formatDurationMmSsMs(bestTimeMs ?? finalScoreMs ?? score)}
                statusLabel={bestTimeMs == null || (finalScoreMs ?? score) <= bestTimeMs ? 'New Best!' : 'Run Complete'}
                statusClassName={bestTimeMs == null || (finalScoreMs ?? score) <= bestTimeMs ? 'text-sat0' : 'text-neutral0'}
                reviewTitle='Question Review'
                reviewItems={reviewItems}
            />
        )
    }

    return (
        <div className='w-full h-full min-h-[420px] flex flex-col gap-12'>
            <div className='w-full flex items-center justify-center gap-6'>
                <div className='flex flex-col items-center justify-center'>
                    <p className={`text-2xl font-semibold tabular-nums transition-all duration-300 ${isPenaltyFlashing ? 'text-red-500 scale-110' : 'text-neutral0 scale-100'}`}>
                        {formatDurationMmSsMs(score)}
                    </p>
                    <p className='text-sm text-neutral1'>Elapsed Time</p>
                </div>
            </div>

            <div className='relative flex-1 flex min-h-0'>
                <QuestionPane
                    gameState={{ questionIndex }}
                    currentQuestion={currentQuestion}
                    submittedResponse={submittedResponse}
                    isSprQuestion={isSprQuestion}
                    isCalculatorOpen={isCalculatorOpen}
                    onToggleCalculator={() => setIsCalculatorOpen((previous) => !previous)}
                    isBusy={false}
                    hasAnswered={false}
                    onChoiceSelect={(choiceId) => setSubmittedResponse(String(choiceId ?? ''))}
                    onResponseChange={setSubmittedResponse}
                    onSubmit={handleSubmit}
                />

                <SingleplayerQuestionResultOverlay
                    isOpen={isResultOverlayActive}
                    startedAtMs={resultOverlay?.startedAtMs ?? 0}
                    nowMs={nowMs}
                    durationMs={OVERLAY_DURATION_MS}
                    mode={resultOverlay?.mode ?? 'question_result'}
                    isCorrect={Boolean(resultOverlay?.isCorrect)}
                    correctAnswer={resultOverlay?.correctAnswer ?? null}
                    penaltyMs={resultOverlay?.penaltyMs ?? 0}
                />
            </div>

            <CalculatorWindow
                isOpen={isCalculatorOpen}
                onClose={() => setIsCalculatorOpen(false)}
            />
        </div>
    )
}

export default BlitzGame