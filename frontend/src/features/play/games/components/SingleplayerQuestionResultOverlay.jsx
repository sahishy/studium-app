const OVERLAY_DURATION_MS = 3000
const WRONG_ANSWER_PENALTY_MS = 20000

const SingleplayerQuestionResultOverlay = ({
    isOpen = false,
    startedAtMs = 0,
    nowMs = 0,
    durationMs = OVERLAY_DURATION_MS,
    mode = 'question_result',
    isCorrect = false,
    correctAnswer = null,
    penaltyMs = 0,
}) => {
    if(!isOpen) {
        return null
    }

    const remainingMs = Math.max(0, durationMs - (nowMs - startedAtMs))
    const countdown = Math.max(0, Math.ceil(remainingMs / 1000))
    const progressRatio = Math.max(0, Math.min(1, remainingMs / durationMs))

    return (
        <div className='absolute inset-0 z-20 pb-10 bg-neutral6/60 backdrop-blur-sm flex items-center justify-center'>
            <div className='pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-neutral6 to-transparent' />
            <div className='pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-neutral6 to-transparent' />
            <div className='pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-neutral6 to-transparent' />
            <div className='pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-neutral6 to-transparent' />

            <div className='text-center'>
                {mode === 'start' ? (
                    <>
                        <p className='text-6xl font-bold leading-none'>{countdown}</p>
                        <p className='text-sm text-neutral1 mt-2'>Get ready...</p>
                    </>
                ) : (
                    <>
                        <p className={`mb-1 text-3xl font-semibold ${isCorrect ? 'text-sat0' : 'text-red-500'}`}>
                            {isCorrect ? 'Correct' : 'Incorrect'}
                        </p>

                        <p className='mb-3 text-sm text-neutral1'>
                            The correct answer was {correctAnswer ?? '—'}.
                        </p>
                    </>
                )}
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

export {
    OVERLAY_DURATION_MS,
    WRONG_ANSWER_PENALTY_MS,
}

export default SingleplayerQuestionResultOverlay