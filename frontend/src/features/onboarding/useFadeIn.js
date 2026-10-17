import { useEffect, useState } from 'react'

// Commit an invisible frame before entering, including for newly mounted steps.
export default function useFadeIn(enabled = true) {
    const [entered, setEntered] = useState(false)
    useEffect(() => {
        if(!enabled){setEntered(false);return}
        let secondFrame
        const firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(() => setEntered(true))
        })
        return () => {
            cancelAnimationFrame(firstFrame)
            if(secondFrame !== undefined)cancelAnimationFrame(secondFrame)
        }
    }, [enabled])
    return enabled && entered
}
