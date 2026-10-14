import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const CalendarTaskPopover = ({ anchor, onClose, children }) => {
    const panelRef = useRef(null)
    const [position, setPosition] = useState(null)

    useLayoutEffect(() => {
        const updatePosition = () => {
            if(!anchor?.isConnected) { onClose(); return }
            const trigger = anchor.getBoundingClientRect()
            const panel = panelRef.current.getBoundingClientRect()
            const gap = 8
            const top = trigger.bottom + panel.height + gap <= window.innerHeight
                ? trigger.bottom + gap : trigger.top - panel.height - gap
            setPosition({
                top: Math.max(gap, Math.min(top, window.innerHeight - panel.height - gap)),
                left: Math.max(gap, Math.min(trigger.left, window.innerWidth - panel.width - gap)),
            })
        }
        updatePosition()
        const observer = new ResizeObserver(updatePosition)
        observer.observe(panelRef.current)
        window.addEventListener('resize', updatePosition)
        window.addEventListener('scroll', updatePosition, true)
        return () => {
            observer.disconnect()
            window.removeEventListener('resize', updatePosition)
            window.removeEventListener('scroll', updatePosition, true)
        }
    }, [anchor, onClose])

    useEffect(() => {
        panelRef.current?.focus({ preventScroll: true })
        const outsideClick = (event) => {
            if(!panelRef.current?.contains(event.target) && !anchor?.contains(event.target)) onClose()
        }
        const escape = (event) => {
            if(event.key !== 'Escape') return
            event.stopPropagation()
            onClose()
            anchor?.focus()
        }
        document.addEventListener('click', outsideClick)
        document.addEventListener('keydown', escape)
        return () => {
            document.removeEventListener('click', outsideClick)
            document.removeEventListener('keydown', escape)
        }
    }, [anchor, onClose])

    return createPortal(<div ref={panelRef} role='dialog' aria-label='Task details' tabIndex={-1} onClick={(event) => event.stopPropagation()} className='fixed z-[3000] max-h-[min(70dvh,560px)] w-[360px] max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-neutral4/70 bg-neutral6 p-3 shadow-xl shadow-shadow outline-none' style={{ ...position, visibility: position ? 'visible' : 'hidden' }}>{children}</div>, document.body)
}

export default CalendarTaskPopover
