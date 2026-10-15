import { useEffect, useRef, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { post } from '../../../shared/services/apiService'

const useReviewHeart = (reviewId, userId) => {
    const [state, setState] = useState({ active: false, count: 0, loading: true, error: '' })
    const [pending, setPending] = useState(false)
    const requestPending = useRef(false)

    useEffect(() => {
        setState({ active: false, count: 0, loading: true, error: '' })
        if(!reviewId || !userId) return
        const fail = error => setState(current => ({ ...current, loading: false, error: error.message }))
        const unsubscribeReview = onSnapshot(doc(db, 'courseReviews', reviewId), snapshot => {
            setState(current => ({ ...current, count: Number(snapshot.data()?.heartsCount) || 0 }))
        }, fail)
        const unsubscribeHeart = onSnapshot(doc(db, 'courseReviews', reviewId, 'hearts', userId), snapshot => {
            setState(current => ({ ...current, active: snapshot.exists(), loading: false }))
        }, fail)
        return () => { unsubscribeReview(); unsubscribeHeart() }
    }, [reviewId, userId])

    const toggle = async () => {
        if(requestPending.current || !reviewId || !userId) return
        requestPending.current = true
        setPending(true)
        setState(current => ({ ...current, error: '' }))
        try {
            await post(`/v1/course-reviews/${encodeURIComponent(reviewId)}/heart`)
        } catch(error) {
            setState(current => ({ ...current, error: error.message }))
        } finally {
            requestPending.current = false
            setPending(false)
        }
    }

    return { ...state, pending, toggle }
}

export { useReviewHeart }
