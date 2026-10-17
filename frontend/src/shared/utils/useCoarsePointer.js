import { useEffect, useState } from 'react'

const useCoarsePointer = () => {
    const [coarsePointer, setCoarsePointer] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)
    useEffect(() => {
        const query = window.matchMedia('(pointer: coarse)')
        const update = () => setCoarsePointer(query.matches)
        update()
        query.addEventListener('change', update)
        return () => query.removeEventListener('change', update)
    }, [])
    return coarsePointer
}

export default useCoarsePointer
