import { useEffect, useState } from 'react'
import { FaArrowTrendUp } from 'react-icons/fa6'
import ProgressBar from '../../../shared/components/ui/ProgressBar'
import { getRarityStyle } from '../../economy/utils/rarityUtils'
import { QUEST_GROUP_ICONS } from '../utils/questPresentation.jsx'

// A completed quest is allowed to finish filling before anything else changes: the bar reaching
// the end is the payoff, so the swap to the claim line waits for it rather than racing it.
const FILL_DELAY_MS = 260
const FILL_MS = 700
const HOLD_MS = 1000
const FILLED_AT_MS = FILL_DELAY_MS + FILL_MS
const SWAP_AT_MS = FILLED_AT_MS + HOLD_MS

const QuestToast = ({ quest, previous = 0 }) => {

    const [value, setValue] = useState(previous)
    const [claimShown, setClaimShown] = useState(false)
    const [popped, setPopped] = useState(false)
    const isComplete = quest.completed
    const rarity = getRarityStyle(quest.rarity)

    useEffect(() => {
        // Start at the old value so the bar is seen filling to the new one.
        const timeoutId = window.setTimeout(() => setValue(quest.current), FILL_DELAY_MS)
        return () => window.clearTimeout(timeoutId)
    }, [quest.current])

    useEffect(() => {
        if(!isComplete) return undefined

        const popId = window.setTimeout(() => setPopped(true), FILLED_AT_MS)
        const swapId = window.setTimeout(() => setClaimShown(true), SWAP_AT_MS)

        return () => {
            window.clearTimeout(popId)
            window.clearTimeout(swapId)
        }
    }, [isComplete])

    return (
        <div className='flex items-center gap-4 min-w-72'>

            <div className={`shrink-0 p-3 rounded-xl text-lg ${rarity.tint} ${rarity.text}`}>
                {QUEST_GROUP_ICONS[quest.group]}
            </div>

            <div className='flex-1 min-w-0 flex flex-col gap-1.5'>

                <div className='flex items-baseline justify-between gap-3'>
                    <p className='text-sm font-semibold text-neutral0 truncate'>{quest.label}</p>
                    <span className='shrink-0 text-xs font-semibold text-neutral1'>
                        {Math.min(quest.current, quest.target)}/{quest.target}
                    </span>
                </div>

                {/* Both states share one fixed-height row so the toast does not resize as the bar
                    hands over to the claim line. */}
                <div className='relative flex h-5 items-center'>

                    <div className={`absolute inset-x-0 transition-opacity duration-300
                        ${claimShown ? 'opacity-0' : 'opacity-100'}
                        ${popped ? 'animate-quest-bar-pop' : ''}`}
                    >
                        <ProgressBar
                            value={value}
                            max={quest.target}
                            className='h-2'
                            fillTransitionClassName='transition-all ease-out '
                            fillStyle={{ backgroundColor: rarity.color, transitionDuration: `${FILL_MS}ms` }}
                        />
                    </div>

                    <div
                        className={`absolute inset-x-0 flex items-center gap-1.5 text-xs font-semibold text-neutral1
                            transition-opacity duration-300 delay-150 ${claimShown ? 'opacity-100' : 'opacity-0'}`}
                    >
                        <span>Complete! Claim in</span>
                        <FaArrowTrendUp />
                        <span>Progress</span>
                    </div>

                </div>

            </div>

        </div>
    )
}

export default QuestToast
