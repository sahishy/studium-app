import { useEffect, useMemo, useState } from 'react'
import { subscribeToGameSnapshot, sendGameMessage } from '../../services/realtimeSocketService'
import QuestionPane from '../sat-classic/components/QuestionPane'
import CalculatorWindow from '../../components/windows/CalculatorWindow'
import LoadingState from '../../../../shared/components/ui/LoadingState'
import Card from '../../../../shared/components/ui/Card'

const formatDurationMmSsMs = (milliseconds = 0) => {
    const safe = Math.max(0, Number(milliseconds) || 0)
    const minutes = Math.floor(safe / 60000)
    const seconds = Math.floor((safe % 60000) / 1000)
    const hundredths = Math.floor((safe % 1000) / 10)
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
}

const BlitzGame = ({ roomId }) => {
    const [snapshot, setSnapshot] = useState(null)
    const [response, setResponse] = useState('')
    const [calculatorOpen, setCalculatorOpen] = useState(false)
    const [now, setNow] = useState(Date.now())
    const [lastEventId, setLastEventId] = useState(null)

    useEffect(() => subscribeToGameSnapshot(roomId, setSnapshot), [roomId])
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 20)
        return () => clearInterval(timer)
    }, [])

    const state = snapshot?.room?.state
    const currentQuestion = state?.currentQuestion
    const latestAnswerEvent = [...(snapshot?.events ?? [])].reverse().find((event) => event.type === 'BLITZ_ANSWERED')
    const overlayOpen = latestAnswerEvent && latestAnswerEvent.uid !== lastEventId
    const startCountdown = state ? Math.max(0, Math.ceil((Number(state.startedAt) - now) / 1000)) : 0
    const score = state ? Math.max(0, (state.phase === 'finished' ? Number(state.score) : now - Number(state.startedAt || now) + Number(state.penaltyMs || 0))) : 0
    const review = useMemo(() => state?.answers ?? [], [state?.answers])

    useEffect(() => setResponse(''), [state?.questionIndex])
    useEffect(() => {
        if(!overlayOpen) return
        const timer = setTimeout(() => setLastEventId(latestAnswerEvent.uid), 3000)
        return () => clearTimeout(timer)
    }, [overlayOpen, latestAnswerEvent])

    if(!state) return <LoadingState className='min-h-[420px]' />

    if(state.phase === 'finished') {
        return (
            <div className='w-full h-full min-h-[420px] flex flex-col items-center gap-6 overflow-y-auto py-10'>
                <div className='text-center'>
                    <h1 className='text-5xl font-bold text-sat0'>Blitz Complete</h1>
                    <p className='text-3xl font-semibold tabular-nums mt-3'>{formatDurationMmSsMs(state.score)}</p>
                </div>
                <div className='w-full max-w-3xl flex flex-col gap-3'>
                    {review.map((answer, index) => (
                        <Card key={answer.questionId} className='p-4!'>
                            <p className='font-semibold'>Question {index + 1} — <span className={answer.isCorrect ? 'text-sat0' : 'text-red-400'}>{answer.isCorrect ? 'Correct' : 'Incorrect'}</span></p>
                            <p className='text-xs text-neutral1'>Your answer: {answer.submittedResponse} · Correct answer: {answer.correctAnswer}</p>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className='w-full h-full min-h-[420px] flex flex-col gap-8'>
            <div className='text-center'>
                <p className='text-2xl font-semibold tabular-nums'>{formatDurationMmSsMs(score)}</p>
                <p className='text-sm text-neutral1'>Elapsed Time · Question {Number(state.questionIndex) + 1} / 10</p>
            </div>
            <div className='relative flex-1 min-h-0'>
                <QuestionPane
                    gameState={state}
                    currentQuestion={currentQuestion}
                    submittedResponse={response}
                    isSprQuestion={String(currentQuestion?.questionType).toLowerCase() === 'spr'}
                    isCalculatorOpen={calculatorOpen}
                    onToggleCalculator={() => setCalculatorOpen((value) => !value)}
                    isBusy={Boolean(overlayOpen) || startCountdown > 0}
                    hasAnswered={false}
                    onChoiceSelect={(value) => setResponse(String(value))}
                    onResponseChange={setResponse}
                    onSubmit={() => {
                        if(!response.trim()) return
                        sendGameMessage(roomId, 'game.answer', { submittedResponse: response.trim() })
                    }}
                />
                {overlayOpen ? (
                    <div className='absolute inset-0 z-20 bg-neutral6/60 backdrop-blur-sm flex items-center justify-center text-center'>
                        <div>
                            <p className={`text-4xl font-bold ${latestAnswerEvent.data?.isCorrect ? 'text-sat0' : 'text-red-400'}`}>{latestAnswerEvent.data?.isCorrect ? 'Correct' : 'Incorrect'}</p>
                            {!latestAnswerEvent.data?.isCorrect ? <p className='text-sm text-neutral1 mt-2'>+20 second penalty · Correct answer: {latestAnswerEvent.data?.correctAnswer}</p> : null}
                        </div>
                    </div>
                ) : null}
                {startCountdown > 0 ? (
                    <div className='absolute inset-0 z-30 bg-neutral6/70 backdrop-blur-sm flex items-center justify-center'>
                        <p className='text-7xl font-bold text-sat0'>{startCountdown}</p>
                    </div>
                ) : null}
            </div>
            <CalculatorWindow isOpen={calculatorOpen} onClose={() => setCalculatorOpen(false)} />
        </div>
    )
}

export default BlitzGame
