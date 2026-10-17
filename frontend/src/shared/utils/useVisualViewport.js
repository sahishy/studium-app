import { useEffect, useState } from 'react'

const readViewport = () => {
    if(typeof window === 'undefined') return { width: 0, height: 0, left: 0, top: 0 }
    const viewport = window.visualViewport
    return { width: viewport?.width ?? window.innerWidth, height: viewport?.height ?? window.innerHeight, left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0 }
}

const useVisualViewport = () => {
    const [viewport, setViewport] = useState(readViewport)
    useEffect(() => {
        const update = () => setViewport((previous) => {
            const next = readViewport()
            return Object.keys(next).every((key) => next[key] === previous[key]) ? previous : next
        })
        window.addEventListener('resize', update)
        window.visualViewport?.addEventListener('resize', update)
        window.visualViewport?.addEventListener('scroll', update)
        update()
        return () => {
            window.removeEventListener('resize', update)
            window.visualViewport?.removeEventListener('resize', update)
            window.visualViewport?.removeEventListener('scroll', update)
        }
    }, [])
    return viewport
}
export default useVisualViewport
