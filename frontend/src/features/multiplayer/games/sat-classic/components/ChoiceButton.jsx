import { useEffect, useState } from 'react'
import HtmlContent from "../../../../../shared/components/ui/HtmlContent"
import AvatarStack from '../../../../../shared/components/avatar/AvatarStack'

const ChoiceButton = ({ choice, isSelected, isDisabled, isCorrectAnswer = false, isIncorrectSelected = false, answeringPlayers = [], onSelect }) => {

    const answerState = isCorrectAnswer ? 'correct' : (isIncorrectSelected ? 'incorrect' : null)
    const [visibleAnswerState, setVisibleAnswerState] = useState(null)

    useEffect(() => {
        if(!answerState) {
            setVisibleAnswerState(null)
            return () => {}
        }
        const frameId = requestAnimationFrame(() => setVisibleAnswerState(answerState))
        return () => cancelAnimationFrame(frameId)
    }, [answerState])

    return (
        <div className='relative w-full'>
            <button
                type='button'
                onClick={() => onSelect(choice.id)}
                disabled={isDisabled}
                className={`w-full flex items-start gap-3 rounded-xl px-3 py-2 border cursor-pointer transition-all duration-300
                    not-disabled:hover:bg-neutral5 disabled:cursor-not-allowed ${answerState ? '' : 'disabled:opacity-50'}
                    ${visibleAnswerState === 'correct' ? `border-green-500 bg-green-50 dark:border-green-500 dark:bg-green-500/15 ${isSelected ? 'ring-1 ring-green-500' : ''}` : ''}
                    ${visibleAnswerState === 'incorrect' ? `border-red-500 bg-red-50 dark:border-red-500 dark:bg-red-500/15 ${isSelected ? 'ring-1 ring-red-500' : ''}` : ''}
                    ${!visibleAnswerState && isSelected ? 'border-sat0 ring-1 ring-sat0' : ''}
                    ${!visibleAnswerState && !isSelected ? 'border-neutral0 dark:border-neutral4 dark:bg-neutral5' : ''}`}
            >
                <div
                    className={`text-xs aspect-square rounded-full border
                        px-2 flex justify-center items-center select-none
                        transition-colors duration-300
                        ${visibleAnswerState === 'correct' ? 'bg-green-500 text-white border-green-500 dark:border-green-500' : ''}
                        ${visibleAnswerState === 'incorrect' ? 'bg-red-500 text-white border-red-500 dark:border-red-500' : ''}
                        ${!visibleAnswerState && isSelected ? 'bg-sat0 text-white border-sat0' : ''}
                        ${!visibleAnswerState && !isSelected ? 'border-neutral0 dark:border-neutral3' : ''}`}
                >
                    {choice.id}
                </div>

                <div className='flex-1 min-w-0 text-left self-center'>
                    <HtmlContent html={choice.label} className='[&_p]:mb-2' />
                </div>
            </button>

            {answeringPlayers.length ? (
                <AvatarStack
                    users={answeringPlayers}
                    overlapClassName='-space-x-4'
                    className='absolute left-full top-1/2 ml-2 -translate-y-1/2 z-10'
                />
            ) : null}
        </div>
    )

}

export default ChoiceButton
