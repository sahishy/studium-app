import HtmlContent from '../../../../../shared/components/ui/HtmlContent'
import ChoiceButton from './ChoiceButton'
import { FaCalculator } from 'react-icons/fa6'

const DASHES = Array.from({ length: 12 }, (_, i) => i)

const QuestionPane = ({
    gameState,
    currentQuestion,
    submittedResponse,
    isSprQuestion,
    isCalculatorOpen,
    onToggleCalculator,
    isBusy,
    hasAnswered,
    onChoiceSelect,
    onResponseChange,
    onSubmit,
}) => {

    const normalizedResponse = String(submittedResponse ?? '').trim()
    const normalizedResponseUpper = normalizedResponse.toUpperCase()
    const module = String(currentQuestion?.module ?? '').toLowerCase()
    const isMathQuestion = module === 'math'
    const isMathMcq = module === 'math' && !isSprQuestion
    const hasValidResponse = normalizedResponse.length > 0

    const contentSection = (
        <div className='flex-1 flex flex-col min-h-0 pl-6'>
            <div className={`flex flex-col ${isMathMcq && !isCalculatorOpen ? 'items-center text-center' : 'items-start'} bg-neutral5`}>
                <div className='w-full h-full flex justify-between'>
                    <div className='bg-neutral0 text-neutral6 px-2 py-1'>
                        {(gameState?.questionIndex ?? 0) + 1}
                    </div>
                    {isMathQuestion ? (
                        <button
                            type='button'
                            onClick={onToggleCalculator}
                            className={`p-2 cursor-pointer ${isCalculatorOpen ? 'text-neutral0' : 'text-neutral1 hover:text-neutral0'} transition`}
                        >
                            <FaCalculator />
                        </button>
                    ) : null}
                </div>

                <div className='flex gap-1 w-full border-t border-t-transparent'>
                    {DASHES.map((n) => (
                        <div key={n} className='flex-1 h-[3px] bg-neutral0' />
                    ))}
                </div>
            </div>

            <div className='relative flex-1 min-h-0'>
                <div className={`h-full overflow-y-auto overflow-x-visible px-1 flex flex-col gap-6 py-6 ${isMathMcq && !isCalculatorOpen ? 'items-center text-center' : ''}`}>
                    {currentQuestion?.body ? (
                        <HtmlContent html={currentQuestion.body} />
                    ) : null}

                    <HtmlContent html={currentQuestion?.prompt || 'Loading question...'} />

                    {isSprQuestion ? (
                        <input
                            type='text'
                            value={submittedResponse ?? ''}
                            onChange={(event) => onResponseChange?.(event.target.value)}
                            disabled={isBusy}
                            placeholder='Enter your answer'
                            className='w-full max-w-md rounded-xl border border-neutral4 bg-neutral6 p-3 text-neutral0 focus:outline-none focus:ring-2 focus:ring-sat0 disabled:opacity-60'
                        />
                    ) : (
                        <div className='flex flex-col gap-3 w-full'>
                            {(currentQuestion?.choices ?? []).map((choice) => (
                                <ChoiceButton
                                    key={choice.id}
                                    choice={choice}
                                    isSelected={normalizedResponseUpper === choice.id}
                                    isDisabled={isBusy}
                                    onSelect={onChoiceSelect}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className='pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-neutral6 to-transparent z-10' />
                <div className='pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-neutral6 to-transparent z-10' />
            </div>

            <button
                type='button'
                onClick={onSubmit}
                disabled={!hasValidResponse || isBusy}
                className='w-full rounded-full bg-sat0 text-white p-3 font-semibold cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed hover:not-disabled:bg-sat1'
            >
                {hasAnswered ? 'Waiting for opponent...' : 'Submit'}
            </button>
        </div >
    )

    return (
        <>
            {isSprQuestion ? (
                <>
                    <div className='relative flex-1 min-h-0 h-full overflow-y-auto pr-3'>
                        <div className='rounded-xl border border-neutral4 bg-neutral5 p-4 text-sm text-neutral1'>
                            Information here
                        </div>
                    </div>

                    <hr className='border-2 border-neutral1 h-full rounded-full' />

                    {contentSection}
                </>
            ) : isMathMcq ? (
                isCalculatorOpen ? (
                    <>
                        <div className='flex-1 min-h-0 h-full pr-3' />
                        {contentSection}
                    </>
                ) : (
                    <div className='w-full max-w-xl mx-auto flex min-h-0'>
                        {contentSection}
                    </div>
                )
            ) : (
                <>
                    <div className='relative flex-1 min-h-0 h-full overflow-y-auto pr-3'>
                        <HtmlContent html={currentQuestion?.paragraph} />
                    </div>

                    <hr className='border-2 border-neutral1 h-full rounded-full' />

                    {contentSection}
                </>
            )}

        </>

    )

}

export default QuestionPane
