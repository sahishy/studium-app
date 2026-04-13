import HtmlContent from '../../../../../shared/components/ui/HTMLContent'
import ChoiceButton from './ChoiceButton'

const DASHES = Array.from({ length: 12 }, (_, i) => i)

const QuestionPane = ({ gameState, currentQuestion, selectedChoiceId, isBusy, hasAnswered, onChoiceSelect, onSubmit }) => {

    return (
        <>
            <div className='relative flex-1 min-h-0 h-full overflow-y-auto pr-3'>
                <HtmlContent html={currentQuestion?.paragraph} />
            </div>

            <hr className='border-2 border-neutral1 h-full rounded-full' />

            <div className='flex-1 flex flex-col min-h-0 pl-6'>
                <div className='flex flex-col items-start bg-neutral5'>
                    <div className='bg-neutral0 text-neutral6 px-2 py-1'>
                        {(gameState?.questionIndex ?? 0) + 1}
                    </div>

                    <div className='flex gap-1 w-full border-t border-t-transparent'>
                        {DASHES.map((n) => (
                            <div key={n} className='flex-1 h-[3px] bg-neutral0' />
                        ))}
                    </div>
                </div>

                <div className='relative flex-1 min-h-0'>
                    <div className='h-full overflow-y-auto overflow-x-visible px-1 flex flex-col gap-6 py-6'>
                        <HtmlContent html={currentQuestion?.prompt || 'Loading question...'} />

                        <div className='flex flex-col gap-3'>
                            {(currentQuestion?.choices ?? []).map((choice) => (
                                <ChoiceButton
                                    key={choice.id}
                                    choice={choice}
                                    isSelected={selectedChoiceId === choice.id}
                                    isDisabled={isBusy}
                                    onSelect={onChoiceSelect}
                                />
                            ))}
                        </div>
                    </div>

                    <div className='pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-neutral6 to-transparent z-10' />
                    <div className='pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-neutral6 to-transparent z-10' />
                </div>

                <button
                    type='button'
                    onClick={onSubmit}
                    disabled={!selectedChoiceId || isBusy}
                    className='w-full rounded-full bg-sat0 text-white p-3 font-semibold cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed hover:not-disabled:bg-sat1'
                >
                    {hasAnswered ? 'Waiting for opponent...' : 'Submit'}
                </button>
            </div>
        </>

    )
    
}

export default QuestionPane