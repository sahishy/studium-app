import { db } from '../../lib/firebaseAdmin.js'

const toggleReviewHeart = async (userId, reviewId, database = db) => {
    const ref = database.collection('courseReviews').doc(reviewId)
    const heartRef = ref.collection('hearts').doc(userId)
    return database.runTransaction(async transaction => {
        const [review, heart] = await Promise.all([transaction.get(ref), transaction.get(heartRef)])
        if(!review.exists) throw new Error('This review is no longer available.')
        const active = !heart.exists
        const count = Math.max(0, (Number(review.data().heartsCount) || 0) + (active ? 1 : -1))
        if(active) transaction.create(heartRef, { userId, createdAt: new Date() })
        else transaction.delete(heartRef)
        transaction.update(ref, { heartsCount: count })
        return { active, count }
    })
}

const removeCourseReview = async (userId, reviewId) => {
    const ref = db.collection('courseReviews').doc(reviewId)
    const review = await ref.get()
    if(!review.exists) return { ok: true }
    if(review.data().userId !== userId) throw new Error('Unauthorized.')
    await db.recursiveDelete(ref)
    return { ok: true }
}

export { toggleReviewHeart, removeCourseReview }
