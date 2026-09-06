import { FaCircle } from 'react-icons/fa6'
import { getPlayerActivity } from '../../utils/playerActivity'

const PlayerActivityLabel = ({ profile }) => {
    const activity = getPlayerActivity(profile)
    return (
        <p className='flex gap-1 items-center text-sm text-neutral1'>
            <FaCircle className={`text-[6px] shrink-0 ${activity.colorClass}`} />
            <span className='truncate'>{activity.label}</span>
        </p>
    )
}

export default PlayerActivityLabel
