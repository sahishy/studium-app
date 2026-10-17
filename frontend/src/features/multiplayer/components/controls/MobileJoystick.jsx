import { useEffect, useRef, useState } from 'react'
import { joystickInput, NEUTRAL_INPUT } from '../../utils/touchControls'

const MobileJoystick = ({ onInput }) => {
    const pointer = useRef(null)
    const surface = useRef(null)
    const callback = useRef(onInput)
    callback.current = onInput
    const [thumb, setThumb] = useState({ x: 0, y: 0 })

    useEffect(() => {
        const reset = () => {
            pointer.current = null
            setThumb({ x: 0, y: 0 })
            callback.current(NEUTRAL_INPUT)
        }
        const onVisibility = () => { if(document.hidden) reset() }
        window.addEventListener('blur', reset)
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            window.removeEventListener('blur', reset)
            document.removeEventListener('visibilitychange', onVisibility)
            callback.current(NEUTRAL_INPUT)
        }
    }, [])

    const move = (event) => {
        if(pointer.current !== event.pointerId) return
        const rect = surface.current.getBoundingClientRect()
        const next = joystickInput(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2, (rect.width - 64) / 2)
        setThumb(next.thumb)
        callback.current(next.input)
    }
    const release = (event) => {
        if(pointer.current !== event.pointerId) return
        pointer.current = null
        setThumb({ x: 0, y: 0 })
        callback.current(NEUTRAL_INPUT)
        if(event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }

    return <div
        ref={surface}
        role='group'
        aria-label='Flight joystick'
        className='mobile-flight-joystick'
        onPointerDown={(event) => {
            if(pointer.current != null || event.button !== 0) return
            event.preventDefault()
            pointer.current = event.pointerId
            event.currentTarget.setPointerCapture(event.pointerId)
            move(event)
        }}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
    >
        <span aria-hidden='true' className='mobile-joystick-thumb' style={{ transform: `translate(${thumb.x}px, ${thumb.y}px)` }} />
    </div>
}
export default MobileJoystick
