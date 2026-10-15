import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'

// Two frames give the browser a paint opportunity before starting email auth.
export const waitForAuthPaint = () => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
})

export const useAuthSubmission = () => {
    const pendingRef = useRef(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const startSubmission = () => {
        if (pendingRef.current) return false
        pendingRef.current = true
        // Commit feedback before Firebase starts work in the click handler.
        flushSync(() => setIsSubmitting(true))
        return true
    }

    const finishSubmission = () => {
        pendingRef.current = false
        setIsSubmitting(false)
    }

    return { isSubmitting, startSubmission, finishSubmission }
}
