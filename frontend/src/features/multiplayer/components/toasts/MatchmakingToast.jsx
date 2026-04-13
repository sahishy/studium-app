import { useEffect, useMemo, useState } from 'react'
import { FaCheck } from 'react-icons/fa6'
import Button from '../../../../shared/components/ui/Button'
import { IoHourglass } from 'react-icons/io5'
import { formatQueueTimeLabel } from '../../utils/multiplayerUtils'

const MatchmakingToast = ({
    state = 'queueing',
    queuedAt,
    matchCountdownSeconds = 3,
    onLeaveQueue,
}) => {

    const isQueueing = state === 'queueing'
    const [nowMs, setNowMs] = useState(Date.now())

    useEffect(() => {
        if(!isQueueing) {
            return
        }

        const intervalId = setInterval(() => {
            setNowMs(Date.now())
        }, 1000)

        return () => clearInterval(intervalId)
    }, [isQueueing])

    const queueTimeLabel = useMemo(() => {
        const queuedAtMs = queuedAt?.toDate
            ? queuedAt.toDate().getTime()
            : null

        if(!queuedAtMs || !isQueueing) {
            return '0:00'
        }

        const elapsedSeconds = Math.max(0, Math.floor((nowMs - queuedAtMs) / 1000))
        return formatQueueTimeLabel(elapsedSeconds)
    }, [queuedAt, isQueueing, nowMs])

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
