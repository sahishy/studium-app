import { useEffect, useRef, useState } from 'react'
import { formatDurationMmSs } from '../../../../../shared/utils/formatters'
import HealthPanel from './HealthPanel'

const GameHeader = ({ healthBoard, damageIndicators, elapsedSeconds, currentRoundMultiplier }) => {
    
    const [isPopping, setIsPopping] = useState(false)
    const previousSecondRef = useRef(elapsedSeconds)
    const popTimeoutRef = useRef(null)
    const isLowTime = Number(elapsedSeconds) <= 15

    useEffect(() => {

        const currentSecond = Number(elapsedSeconds)
        const previousSecond = Number(previousSecondRef.current)
        const hasNewSecondTick = Number.isFinite(currentSecond)
            && Number.isFinite(previousSecond)
            && currentSecond !== previousSecond

        if(isLowTime && hasNewSecondTick) {
            setIsPopping(true)

            if(popTimeoutRef.current) {
                clearTimeout(popTimeoutRef.current)
            }

            popTimeoutRef.current = setTimeout(() => {
                setIsPopping(false)
            }, 160)
        }

        previousSecondRef.current = currentSecond

    }, [elapsedSeconds])

    useEffect(() => {
        return () => {
            if(popTimeoutRef.current) {
                clearTimeout(popTimeoutRef.current)
            }
        }
    }, [])

    return (
        <div className='w-full flex items-center justify-between gap-6'>
            <HealthPanel
                player={healthBoard.leftPlayer}
                damageIndicator={damageIndicators.left}
            />

            <div className='flex flex-col items-center justify-center'>
                <p
                    className={`text-2xl font-semibold tabular-nums transform transition-all duration-150 ${isLowTime ? 'text-red-500' : ''} ${isPopping ? 'scale-110' : 'scale-100'}`}
                >
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