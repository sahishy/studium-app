import { FaCheck } from 'react-icons/fa6'
import Button from '../../../../shared/components/ui/Button'
import { IoHourglass } from 'react-icons/io5'

const MatchmakingToast = ({
    state = 'queueing',
    queueTimeLabel = '0:00',
    matchCountdownSeconds = 3,
    onLeaveQueue,
}) => {

    const isQueueing = state === 'queueing'

    return (
        <div className='flex flex-col gap-3'>

            <div className='flex flex-col gap-1'>
                <p className='text-sm font-semibold'>
                    {isQueueing ? 'Searching for an opponent...' : `Match found!`}
                </p>
                <p className='text-sm text-text2 flex items-center gap-1'>
                    {isQueueing ? <IoHourglass /> : <FaCheck/>}
                    {isQueueing ? `Queue time: ${queueTimeLabel}` : `Joining room in ${matchCountdownSeconds}...`}
                </p>
            </div>

            {isQueueing && (
                <div className='self-center gap-2'>
                    <Button onClick={onLeaveQueue}>
                        Leave queue
                    </Button>
                </div>
            )}

        </div>
    )
}

export default MatchmakingToast
