import { useEffect, useState } from 'react'
import { FaCheck } from 'react-icons/fa6'
import { PiStarFourFill } from 'react-icons/pi'
import ProgressBar from '../../../shared/components/ui/ProgressBar'
import LumenIcon from '../../economy/components/LumenIcon'
import { QUEST_GROUP_ICONS } from '../utils/questPresentation.jsx'

const QuestToast = ({ quest, previous = 0 }) => {

    const [value, setValue] = useState(previous)
    const isComplete = quest.completed

    useEffect(() => {
        // Start at the old value so the bar is seen filling to the new one.
        const timeoutId = window.setTimeout(() => setValue(quest.current), 260)
        return () => window.clearTimeout(timeoutId)
    }, [quest.current])

    return (
        <div className='flex items-center gap-4 min-w-72'>

            <div className={`shrink-0 p-3 rounded-xl text-lg transition-colors
                ${isComplete ? 'bg-green-400/15 text-green-500' : 'bg-neutral5 text-neutral1'}`}
            >
                {isComplete ? <FaCheck /> : QUEST_GROUP_ICONS[quest.group]}
            </div>

            <div className='flex-1 min-w-0 flex flex-col gap-1.5'>

                <div className='flex items-baseline justify-between gap-3'>
                    <p className='text-sm font-semibold text-neutral0 truncate'>{quest.label}</p>
                    <span className='shrink-0 text-xs font-semibold text-neutral1'>
                        {Math.min(quest.current, quest.target)}/{quest.target}
                    </span>
                </div>

                <ProgressBar
                    value={value}
                    max={quest.target}
                    className='h-2'
                    fillClassName={isComplete ? 'bg-green-400!' : 'bg-sky-400!'}
                    fillTransitionClassName='transition-all duration-700 ease-out motion-reduce:transition-none'
                />

                {isComplete ? (
                    <div className='flex items-center gap-3 text-xs font-semibold'>
                        <span className='flex items-center gap-1 text-yellow-400'>
                            <PiStarFourFill /> +{quest.xp} XP
                        </span>
                        <span className='flex items-center gap-1 text-sky-500'>
                            <LumenIcon className='size-3' /> +{quest.lumen}
                        </span>
                    </div>
                ) : null}

            </div>

        </div>
    )
}

export default QuestToast
