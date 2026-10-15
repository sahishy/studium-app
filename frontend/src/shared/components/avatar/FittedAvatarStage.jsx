import { useLayoutEffect, useRef, useState } from 'react'

// Keep the authored composition at its normal size until either dimension runs
// out of room. Scale the whole stage so labels and podiums stay with the model.
// Minimum dimensions are in rem, matching the layouts being fitted.
const FittedAvatarStage = ({ minWidth, minHeight, className = '', children }) => {
    const containerRef = useRef(null)
    const [scale, setScale] = useState(1)

    useLayoutEffect(() => {
        const container = containerRef.current
        const updateScale = () => {
            const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
            const { width, height } = container.getBoundingClientRect()
            if (width <= 0 || height <= 0) return
            setScale(Math.min(1, width / (minWidth * rem), height / (minHeight * rem)))
        }

        updateScale()
        const observer = new ResizeObserver(updateScale)
        observer.observe(container)
        return () => observer.disconnect()
    }, [minWidth, minHeight])

    return (
        <div ref={containerRef} className={`relative min-w-0 min-h-0 ${className}`}>
            <div
                className='absolute bottom-0 left-1/2'
                style={{
                    width: `${100 / scale}%`,
                    height: `${100 / scale}%`,
                    transform: `translateX(-50%) scale(${scale})`,
                    transformOrigin: 'bottom center',
                }}
            >
                {children}
            </div>
        </div>
    )
}

export default FittedAvatarStage
