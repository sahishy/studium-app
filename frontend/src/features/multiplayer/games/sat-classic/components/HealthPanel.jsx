import { FaHeart } from 'react-icons/fa6'
import { SAT_CLASSIC_INITIAL_HEALTH } from '../services/satClassicGameService'
import AvatarPicture from '../../../../../shared/components/avatar/AvatarPicture'
import ProgressBar from '../../../../../shared/components/ui/ProgressBar'
import { evaluateGradientColor } from '../../../../../shared/utils/colorUtils'

const DAMAGE_INDICATOR_DURATION_MS = 1500

const HealthPanel = ({ player, align = 'start', damageIndicator = null }) => {

    const healthValue = Math.max(0, Number(player?.health) || 0)
    const isEndAligned = align === 'end'

    const healthColor = evaluateGradientColor(
        ['#ef4444', '#f59e0b', '#22c55e', '#22c55e'],
        healthValue / SAT_CLASSIC_INITIAL_HEALTH
    )

    const indicatorProgress = damageIndicator
        ? Math.max(0, Math.min(1, (Date.now() - damageIndicator.startedAtMs) / DAMAGE_INDICATOR_DURATION_MS))
        : 1

    const showDamageIndicator = damageIndicator && indicatorProgress < 1

    return (
        <div className={`flex-1 max-w-xs ${isEndAligned ? 'items-end' : ''}`}>

            <div className={`flex items-center gap-3 mb-2 ${isEndAligned ? 'flex-row-reverse items-end' : ''}`}>

                <AvatarPicture
                    profile={{ profile: { profilePicture: player?.profilePicture ?? null } }}
                    className='w-12 h-12'
                />

                <div className={`min-w-0 ${isEndAligned ? 'text-right' : ''}`}>
                    <p className='text-sm truncate'>{player?.name || 'Waiting...'}</p>

                    <div className={`flex gap-3 items-center ${isEndAligned ? 'flex-row-reverse' : ''}`}>
                        <p className={`text-sm text-neutral1 flex gap-1 items-center ${isEndAligned ? 'justify-end' : ''}`}>
                            <FaHeart className='text-xs' />
                            {healthValue}
                        </p>

                        {showDamageIndicator ? (
                            <p
                                className={`text-sm text-red-500 flex gap-1 items-center pointer-events-none ${isEndAligned ? 'justify-end' : ''}`}
                                style={{
                                    opacity: 1 - indicatorProgress,
                                    scale: Math.max(1.2 - (0.8 * indicatorProgress), 1),
                                }}
                            >
                                -<FaHeart className='text-xs' />
                                {damageIndicator.amount}
                            </p>
                        ) : null}
                    </div>
                </div>

            </div>

            <ProgressBar
                value={healthValue}
                max={SAT_CLASSIC_INITIAL_HEALTH}
                fillStyle={{ backgroundColor: healthColor }}
            />

        </div>
    )

}

export default HealthPanel