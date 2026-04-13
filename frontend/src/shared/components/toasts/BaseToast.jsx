import { useEffect, useState } from 'react'
import Card from '../ui/Card'
import CloseButton from '../ui/CloseButton'

const BaseToast = ({ children, isVisible, canHide = false, duration = null, onRequestClose }) => {

    const [animate, setAnimate] = useState(false)
    const [progressActive, setProgressActive] = useState(false)
    const [hasStartedProgress, setHasStartedProgress] = useState(false)

    useEffect(() => {
        if(isVisible) {
            const enterTimer = setTimeout(() => setAnimate(true), 10)
            return () => clearTimeout(enterTimer)
        }

        setAnimate(false)
    }, [isVisible])

    useEffect(() => {
        if(duration == null) {
            setProgressActive(false)
            setHasStartedProgress(false)
            return
        }

        if(!isVisible || hasStartedProgress) {
            return
        }

        setProgressActive(false)
        const timer = setTimeout(() => {
            setProgressActive(true)
            setHasStartedProgress(true)
        }, 10)

        return () => clearTimeout(timer)
    }, [duration, hasStartedProgress, isVisible])

    return (
        <div
            className={`
                transition-all duration-250 ease-out
                ${animate ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95'}
            `}
        >
            <Card className='relative overflow-hidden w-fit min-w-80 max-w-[42rem] shadow-2xl! shadow-neutral0/10! group'>
                <div className='flex items-start gap-3'>
                    <div className='flex-1 min-w-0'>
                        {children}
                    </div>

                    {canHide ? (
                        <CloseButton className='shrink-0 p-1! text-lg! self-start opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto' onClick={onRequestClose} />
                    ) : null}
                </div>

                {duration != null ? (
                    <div className='absolute left-0 right-0 bottom-0 h-0.5'>
                        <div
                            className={`h-full bg-neutral4 origin-left transition-transform ease-linear ${progressActive ? 'scale-x-0' : 'scale-x-100'}`}
                            style={{ transitionDuration: `${duration}ms` }}
                        />
                    </div>
                ) : null}
            </Card>
        </div>
    )
}

export default BaseToast
