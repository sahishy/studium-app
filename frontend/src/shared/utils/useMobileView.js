import { useEffect, useState } from 'react'

const useMobileView = () => {
    const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(width < 1024px)').matches)
    useEffect(() => {
        const query = window.matchMedia('(width < 1024px)')
        const update = () => setMobile(query.matches)
        update()
        query.addEventListener('change', update)
        return () => query.removeEventListener('change', update)
    }, [])
    return mobile
}

export default useMobileView
