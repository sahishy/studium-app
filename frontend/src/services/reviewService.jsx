import {
    collection,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    where,
    documentId,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import {
    buildCourseScoreMap,
    clampReviewScore,
    computeAverageScoreFromReviews,
} from '../utils/reviewUtils'
import { createCacheKey, deleteCacheEntry } from './cacheService'
import { CACHE_NAMESPACES } from '../utils/cacheUtils'

const COURSE_SCORE_CACHE_NAMESPACE = CACHE_NAMESPACES.COURSE_SCORE

const buildReviewId = (courseId, userId) => `${String(courseId)}_${String(userId)}`

const upsertCourseReview = async ({
    courseId,
    userId,
    schoolId = null,
    teacherId = null,
    review = '',
    score = 0.5,
}) => {
    const db = getFirestore()
    const reviewId = buildReviewId(courseId, userId)
    const reviewRef = doc(db, 'courseReviews', reviewId)
    const existing = await getDoc(reviewRef)
    const now = serverTimestamp()

    const payload = {
        courseId: String(courseId),
        userId: String(userId),
        schoolId: schoolId ? String(schoolId) : null,
        teacherId: teacherId ? String(teacherId) : null,
        review: String(review ?? '').trim(),
        score: clampReviewScore(score),
        lastUpdated: now,
    }

    if(existing.exists()) {
        await setDoc(reviewRef, payload, { merge: true })
        deleteCacheEntry(createCacheKey(COURSE_SCORE_CACHE_NAMESPACE, courseId))
        return reviewId
    }

    await setDoc(reviewRef, {
        ...payload,
        createdAt: now,
    })

    deleteCacheEntry(createCacheKey(COURSE_SCORE_CACHE_NAMESPACE, courseId))

    return reviewId
}

const getCourseReviews = async (courseId) => {
    const db = getFirestore()
    const reviewsRef = collection(db, 'courseReviews')
    const q = query(
        reviewsRef,
        where('courseId', '==', String(courseId)),
        orderBy('lastUpdated', 'desc')
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map((reviewDoc) => ({ uid: reviewDoc.id, ...reviewDoc.data() }))
}

const useCourseReviews = (courseId) => {
    const [reviews, setReviews] = useState([])

    useEffect(() => {
        if(!courseId) {
            setReviews([])
            return
        }

        const db = getFirestore()
        const reviewsRef = collection(db, 'courseReviews')
        const q = query(
            reviewsRef,
            where('courseId', '==', String(courseId)),
            orderBy('lastUpdated', 'desc')
        )

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setReviews(snapshot.docs.map((reviewDoc) => ({ uid: reviewDoc.id, ...reviewDoc.data() })))
        })

        return () => unsubscribe()
    }, [courseId])

    return reviews
}

const getCourseReviewsForCourseIds = async (courseIds = []) => {
    const normalized = Array.from(new Set((courseIds ?? []).map((id) => String(id)).filter(Boolean)))
    if(normalized.length === 0) {
        return []
    }

    const db = getFirestore()
    const reviewsRef = collection(db, 'courseReviews')
    const results = []

    for(let i = 0; i < normalized.length; i += 30) {
        const chunk = normalized.slice(i, i + 30)
        const q = query(reviewsRef, where('courseId', 'in', chunk))
        const snapshot = await getDocs(q)
        snapshot.docs.forEach((reviewDoc) => {
            results.push({ uid: reviewDoc.id, ...reviewDoc.data() })
        })
    }

    return results
}

const getAverageScoreByCourseIds = async (courseIds = []) => {
    const reviews = await getCourseReviewsForCourseIds(courseIds)
    return buildCourseScoreMap(reviews)
}

const getUsersByIdsMap = async (userIds = []) => {
    const normalized = Array.from(new Set((userIds ?? []).map((id) => String(id)).filter(Boolean)))
    if(normalized.length === 0) {
        return {}
    }

    const db = getFirestore()
    const usersRef = collection(db, 'users')
    const results = {}

    for(let i = 0; i < normalized.length; i += 30) {
        const chunk = normalized.slice(i, i + 30)
        const q = query(usersRef, where(documentId(), 'in', chunk))
        const snapshot = await getDocs(q)
        snapshot.docs.forEach((userDoc) => {
            results[userDoc.id] = { uid: userDoc.id, ...userDoc.data() }
        })
    }

    return results
}

export {
    upsertCourseReview,
    getCourseReviews,
    useCourseReviews,
    getCourseReviewsForCourseIds,
    computeAverageScoreFromReviews,
    buildCourseScoreMap,
    getAverageScoreByCourseIds,
    getUsersByIdsMap,
}