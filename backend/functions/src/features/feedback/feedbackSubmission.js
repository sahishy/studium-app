import { randomUUID } from 'node:crypto'

const rateLimitError = (message) => Object.assign(new Error(message), { statusCode: 429 })

export const submitWithCooldown = async ({ db, uid, deliver, now = Date.now }) => {
    const ref = db.collection('feedbackRateLimits').doc(uid)
    const attemptId = randomUUID()
    await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref)
        const state = snapshot.data() ?? {}
        const time = now()
        if (time - (state.lastSubmittedAt ?? 0) < 60_000) {
            throw rateLimitError('Please wait a minute before submitting more feedback.')
        }
        if (state.pendingAttemptId && time - state.pendingAt < 30_000) {
            throw rateLimitError('Your feedback is still sending. Please wait a moment.')
        }
        transaction.set(ref, { ...state, pendingAttemptId: attemptId, pendingAt: time })
    })

    let result
    try {
        result = await deliver()
    } catch (error) {
        // Failed delivery must not consume the successful-submission cooldown.
        await db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(ref)
            const state = snapshot.data() ?? {}
            if (state.pendingAttemptId === attemptId) {
                transaction.set(ref, { lastSubmittedAt: state.lastSubmittedAt ?? 0 })
            }
        })
        throw error
    }

    await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref)
        if (snapshot.data()?.pendingAttemptId === attemptId) {
            transaction.set(ref, { lastSubmittedAt: now() })
        }
    })
    return result
}
