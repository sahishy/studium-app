import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import confetti from 'canvas-confetti'

export default function MatchEndConfetti() {
    const canvasRef = useRef(null)
    const confettiRef = useRef(null)

    useEffect(() => {
        // A separate canvas lets leaving the results stop this shower without
        // interrupting any level-up celebration.
        const shower = confettiRef.current ??= confetti.create(canvasRef.current, {
            resize: true,
            disableForReducedMotion: true,
        })
        const options = {
            particleCount: 60,
            angle: 270,
            spread: 180,
            startVelocity: 30,
            colors: ['#0EA5E9'],
            shapes: ['square'],
            ticks: 240,
        }
        for(const x of [0.15, 0.5, 0.85]) {
            shower({ ...options, origin: { x, y: -0.2 } })
        }
        return () => shower.reset()
    }, [])

    return createPortal(
        <canvas ref={canvasRef} aria-hidden="true" className="fixed inset-0 size-full pointer-events-none z-[100]" />,
        document.body,
    )
}
