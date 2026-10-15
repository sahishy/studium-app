import { useEffect, useState } from 'react'

// Refresh at local midnight and after returning to a suspended tab.
const useToday = () => {
    const [today, setToday] = useState(() => new Date())
    useEffect(() => {
        let timer
        const refresh = () => {
            const now = new Date()
            setToday((previous) => previous.toDateString() === now.toDateString() ? previous : now)
            const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
            clearTimeout(timer)
            timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 100)
        }
        refresh()
        document.addEventListener('visibilitychange', refresh)
        window.addEventListener('focus', refresh)
        return () => {
            clearTimeout(timer)
            document.removeEventListener('visibilitychange', refresh)
            window.removeEventListener('focus', refresh)
        }
    }, [])
    return today
}

export default useToday
