import { FaFire } from 'react-icons/fa6'
import Card from '../../../shared/components/ui/Card'
import RadialProgress from '../../../shared/components/ui/RadialProgress'
import LumenIcon from '../../economy/components/LumenIcon'

const STREAK_MILESTONES = [3, 7, 14, 30]

const streakReward = (milestone) => milestone * 5

const StreakCard = ({ streak = 0 }) => {

    const nextMilestone = STREAK_MILESTONES.find((value) => value > streak) ?? STREAK_MILESTONES.at(-1)
    const previousMilestone = [...STREAK_MILESTONES].reverse().find((value) => value <= streak) ?? 0
    const daysLeft = Math.max(0, nextMilestone - streak)

    return (
        <Card className='p-5! gap-4! items-center'>

            <RadialProgress
                value={streak - previousMilestone}
                max={Math.max(1, nextMilestone - previousMilestone)}
                size={116}
                thickness={7}
                fillClassName='text-orange-400'
            >
                <FaFire className={`text-4xl ${streak > 0 ? 'text-orange-400' : 'text-neutral2'}`} />
            </RadialProgress>

            <div className='flex flex-col items-center gap-1'>

                <p className='text-xl font-semibold text-neutral0'>
                    {streak} day{streak === 1 ? '' : 's'}
                </p>

                <p className='flex flex-wrap items-center justify-center gap-1 text-xs text-neutral1'>
                    {daysLeft} day{daysLeft === 1 ? '' : 's'} left until
                    <span className='flex items-center gap-1 font-semibold text-sky-500'>
                        <LumenIcon className='size-3' />{streakReward(nextMilestone)}
                    </span>
                </p>

            </div>

        </Card>
    )
}

export { STREAK_MILESTONES, streakReward }
export default StreakCard
