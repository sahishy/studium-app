import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

test('review hearts persist, count concurrent users, and clean up on deletion', { skip: process.env.USE_FIREBASE_EMULATORS !== 'true' }, async () => {
    const { db } = await import('../../lib/firebaseAdmin.js')
    const { toggleReviewHeart, removeCourseReview } = await import('./reviewHeartService.js')
    const id = `review_hearts_${randomUUID()}`
    const ref = db.collection('courseReviews').doc(id)
    try {
        await ref.set({ courseId: 'test', userId: 'author', review: 'Useful', score: 1 })
        assert.deepEqual(await toggleReviewHeart('a', id), { active: true, count: 1 })
        assert.equal((await ref.collection('hearts').doc('a').get()).exists, true)
        assert.deepEqual(await toggleReviewHeart('a', id), { active: false, count: 0 })
        assert.equal((await ref.collection('hearts').doc('a').get()).exists, false)
        await Promise.all(['a', 'b', 'c'].map(uid => toggleReviewHeart(uid, id)))
        assert.equal((await ref.get()).data().heartsCount, 3)
        await Promise.all([toggleReviewHeart('a', id), toggleReviewHeart('a', id)])
        assert.equal((await ref.get()).data().heartsCount, 3)
        assert.equal((await ref.collection('hearts').doc('a').get()).exists, true)
        await assert.rejects(removeCourseReview('other', id), /Unauthorized/)
        await removeCourseReview('author', id)
        assert.equal((await ref.get()).exists, false)
        assert.equal((await ref.collection('hearts').get()).size, 0)
        await assert.rejects(toggleReviewHeart('a', id), /no longer available/)
        await ref.set({ courseId: 'test', userId: 'author', review: 'Reposted', score: 1 })
        assert.deepEqual(await toggleReviewHeart('a', id), { active: true, count: 1 })
    } finally {
        await db.recursiveDelete(ref)
    }
})

test('review rules protect hearts and allow owners to edit legacy reviews', { skip: process.env.USE_FIREBASE_EMULATORS !== 'true' }, async () => {
    const { db, auth } = await import('../../lib/firebaseAdmin.js')
    const session = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `review_${randomUUID()}@example.test`, password: 'EmulatorQA2026!', returnSecureToken: true }),
    }).then(response => response.json())
    const uid = session.localId
    const id = `test_${uid}`
    const ref = db.collection('courseReviews').doc(id)
    const call = (path, method, fields) => fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/studium-io/databases/(default)/documents/${path}`, {
        method, headers: { Authorization: `Bearer ${session.idToken}`, 'Content-Type': 'application/json' },
        ...(fields ? { body: JSON.stringify({ fields }) } : {}),
    })
    const str = stringValue => ({ stringValue })
    const number = value => ({ integerValue: String(value) })
    const fields = { userId: str(uid), courseId: str('test'), review: str('Review'), score: { doubleValue: 0.9 } }
    try {
        assert.equal((await call(`courseReviews/${id}`, 'PATCH', { ...fields, heartsCount: number(10) })).status, 403)
        assert.equal((await call(`courseReviews/${id}`, 'PATCH', { ...fields, schoolId: str('retired') })).status, 403)
        assert.equal((await call(`courseReviews/${id}`, 'PATCH', fields)).status, 200)
        await ref.set({ userId: uid, courseId: 'test', review: 'Old', score: 1, schoolId: 'retired', teacherId: 'legacy', heartsCount: 2 })
        const legacy = { ...fields, schoolId: str('retired'), teacherId: str('legacy'), heartsCount: number(2) }
        assert.equal((await call(`courseReviews/${id}`, 'PATCH', legacy)).status, 200)
        assert.equal((await call(`courseReviews/${id}`, 'PATCH', { ...legacy, heartsCount: number(50) })).status, 403)
        assert.equal((await call(`courseReviews/${id}`, 'DELETE')).status, 403)
        assert.equal((await call(`courseReviews/${id}/hearts/${uid}`, 'PATCH', { userId: str(uid) })).status, 403)
        await ref.collection('hearts').doc(uid).set({ userId: uid })
        await ref.collection('hearts').doc('other').set({ userId: 'other' })
        assert.equal((await call(`courseReviews/${id}/hearts/${uid}`, 'GET')).status, 200)
        assert.equal((await call(`courseReviews/${id}/hearts/other`, 'GET')).status, 403)
        await ref.update({ userId: 'other' })
        assert.equal((await call(`courseReviews/${id}`, 'PATCH', legacy)).status, 403)
    } finally {
        await db.recursiveDelete(ref)
        await auth.deleteUser(uid)
    }
})
