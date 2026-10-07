import { FaCheck, FaClipboardList } from 'react-icons/fa6'
import { PiStarFourFill } from 'react-icons/pi'
import Card from '../../../shared/components/ui/Card'
import ProgressBar from '../../../shared/components/ui/ProgressBar'
import LumenIcon from '../../economy/components/LumenIcon'
import { useQuests } from '../QuestContext'
import { QUEST_GROUP_ICONS } from '../utils/questPresentation.jsx'

const QuestBoard = ({ className = '' }) => {

    const { quests } = useQuests()

    if(!quests.length) return null

    return (
        <Card className={`p-5! gap-4! ${className}`}>

            <h2 className='flex items-center gap-2 text-sm font-semibold text-neutral0'>
                Daily quests
                <FaClipboardList className='text-sm text-neutral1' />
            </h2>

            <div className='flex flex-col gap-4'>
                {quests.map((quest) => (
                    <div key={quest.id} className='flex items-start gap-3'>

                        <div className={`shrink-0 size-8 rounded-lg flex items-center justify-center text-xs transition-colors
                            ${quest.completed ? 'bg-green-400/15 text-green-500' : 'bg-neutral5 text-neutral1'}`}
                        >
                            {quest.completed ? <FaCheck /> : QUEST_GROUP_ICONS[quest.group]}
                        </div>

                        <div className='flex-1 min-w-0 flex flex-col gap-1.5'>

                            <div className='flex items-baseline justify-between gap-3'>

                                <p className={`text-xs font-semibold truncate ${quest.completed ? 'text-neutral1 line-through' : 'text-neutral0'}`}>
                                    {quest.label}
                                </p>

                                <div className='shrink-0 flex items-center gap-2 text-[0.7rem] font-semibold'>
                                    <span className={`flex items-center gap-1 ${quest.completed ? 'text-neutral2' : 'text-yellow-400'}`}>
                                        <PiStarFourFill /> {quest.xp}
                                    </span>
                                    <span className={`flex items-center gap-1 ${quest.completed ? 'text-neutral2' : 'text-sky-500'}`}>
                                        <LumenIcon className={`size-3 ${quest.completed ? 'grayscale opacity-60' : ''}`} /> {quest.lumen}
                                    </span>
                                </div>

                            </div>

                            <ProgressBar
                                value={quest.current}
                                max={quest.target}
                                className='h-1.5'
                                fillClassName={quest.completed ? 'bg-green-400!' : 'bg-sky-400!'}
                            />

                        </div>

                    </div>
                ))}
            </div>

        </Card>
    )
}

export default QuestBoard
