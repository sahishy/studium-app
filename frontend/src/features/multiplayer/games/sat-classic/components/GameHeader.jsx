import { formatDurationMmSs } from '../../../../../shared/utils/formatters'
import HealthPanel from './HealthPanel'

const GameHeader = ({ healthBoard, damageIndicators, elapsedSeconds, currentRoundMultiplier }) => {
    return (
        <div className='w-full flex items-center justify-between gap-6'>
            <HealthPanel
                player={healthBoard.leftPlayer}
                damageIndicator={damageIndicators.left}
            />

            <div className='flex flex-col items-center justify-center'>
                <p className='text-2xl font-semibold tabular-nums'>
                    {formatDurationMmSs(elapsedSeconds)}
                </p>
                <p className='text-sm text-neutral1'>
                    {currentRoundMultiplier.toFixed(1)}x damage
                </p>
            </div>

            <HealthPanel
                player={healthBoard.rightPlayer}
                align='end'
                damageIndicator={damageIndicators.right}
            />
        </div>
    )
}

export default GameHeader