import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { subscribeToGameFocusBlur } from '../utils/gameFocusBlur'

const GameFocusBlur = () => {
    const overlayRef = useRef(null)

    useLayoutEffect(() => subscribeToGameFocusBlur({
        windowTarget: window,
        documentTarget: document,
        // Update immediately in the event handler, without waiting for a React render.
        onChange: (blurred) => {
            overlayRef.current.style.display = blurred ? 'block' : 'none'
        },
    }), [])

    return createPortal(
        <div
            ref={overlayRef}
            aria-hidden='true'
            className='fixed inset-0 pointer-events-none'
            style={{
                display: 'none',
                zIndex: 2147483647,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
            }}
        />,
        document.body,
    )
}

export default GameFocusBlur
