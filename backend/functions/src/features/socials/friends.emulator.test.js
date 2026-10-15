import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

test('profiles and friendships preserve account data and enforce participant authorization', { skip: process.env.USE_FIREBASE_EMULATORS !== 'true' }, async t => {
    const { db, auth } = await import('../../lib/firebaseAdmin.js')
    const { ensureUserProfile } = await import('../auth/profileService.js')
    const { removeFriend, respondToFriendRequest } = await import('./friendService.js')
    const { handlePresenceChange } = await import('../presence/presenceHandler.js')
    const { saveActivityUpdates } = await import('../realtime/activityService.js')
    const sessions = await Promise.all([0, 1, 2].map(async () => {
        const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: `friends_${randomUUID()}@example.test`, password: 'EmulatorQA2026!', returnSecureToken: true }),
        })
        assert.equal(response.status, 200)
        return response.json()
    }))
    const [a, b, outsider] = sessions.map(session => session.localId)
    const requestId = `friends_${randomUUID()}`
    const requestRef = db.collection('friendRequests').doc(requestId)
    const userRef = uid => db.collection('users').doc(uid)
    const friendship = (uid, other) => userRef(uid).collection('friends').doc(other)
    const call = (session, path, method = 'GET', body) => fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/studium-io/databases/(default)/documents${path.startsWith(':') ? '' : '/'}${path}`, {
        method, headers: { Authorization: `Bearer ${session.idToken}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const str = stringValue => ({ stringValue })
    try {
        await t.test('presence cannot create a profile before signup, on disconnect, or after deletion', async () => {
            for(const [before, after] of [[null, { state: 'online' }], [{ state: 'online' }, { state: 'offline' }]]) {
                await handlePresenceChange.run({ params: { uid: a }, data: { before: { val: () => before }, after: { val: () => after } } })
                assert.equal((await userRef(a).get()).exists, false)
            }
            await assert.rejects(saveActivityUpdates({ updates: [{ userId: a, activity: { state: 'online' } }] }))
            assert.equal((await userRef(a).get()).exists, false)
        })
        await t.test('first signup and concurrent repair fill defaults without resetting data', async () => {
            await userRef(a).set({ status: 'active', progress: { streak: 7, xp: 1200, level: 8 }, primaryCircleId: 'keep', circleMemberships: { version: 1, ids: ['keep'] } })
            const identity = { uid: a, email: sessions[0].email }
            await Promise.all(['RepairPlayer123', 'RepairPlayer456'].map(displayName => ensureUserProfile(identity, { displayName, timeZone: 'America/New_York' })))
            const repaired = (await userRef(a).get()).data()
            assert.ok(['RepairPlayer123', 'RepairPlayer456'].includes(repaired.profile.displayName))
            assert.equal(repaired.progress.xp, 1200)
            assert.equal(repaired.progress.level, 8)
            assert.equal(repaired.progress.streak, 7)
            assert.equal(repaired.primaryCircleId, 'keep')
            assert.deepEqual(repaired.circleMemberships.ids, ['keep'])
            await db.collection('userStats').doc(a).update({ play: { wins: 12 }, mastery: { Algebra: { correct: 30 } } })
            await userRef(a).update({ 'profile.avatar.face': 9, 'profile.flair': 'earned' })
            await ensureUserProfile(identity, { displayName: 'ReplacementName' })
            const kept = (await userRef(a).get()).data()
            assert.equal(kept.profile.displayName, repaired.profile.displayName)
            assert.equal(kept.profile.avatar.face, 9)
            assert.equal(kept.profile.flair, 'earned')
            assert.deepEqual((await db.collection('userStats').doc(a).get()).data().play, { wins: 12 })
            assert.deepEqual((await db.collection('userStats').doc(a).get()).data().mastery, { Algebra: { correct: 30 } })
            await ensureUserProfile({ uid: b }, { displayName: 'NewFriendPlayer123' })
            assert.equal((await userRef(b).get()).data().progress.level, 1)
            assert.equal((await db.collection('userStats').doc(b).get()).exists, true)
        })
        await t.test('requests can only be sent as yourself and read by their participants', async () => {
            const fields = { fromUserId: str(a), toUserId: str(b), createdAt: { timestampValue: new Date().toISOString() } }
            assert.equal((await call(sessions[2], `friendRequests/${requestId}`, 'PATCH', { fields })).status, 403)
            assert.equal((await call(sessions[0], `friendRequests/${requestId}`, 'PATCH', { fields: { ...fields, toUserId: str(a) } })).status, 403)
            assert.equal((await call(sessions[0], `friendRequests/${requestId}`, 'PATCH', { fields })).status, 200)
            assert.equal((await call(sessions[1], `friendRequests/${requestId}`)).status, 200)
            assert.equal((await call(sessions[2], `friendRequests/${requestId}`)).status, 403)
            assert.equal((await call(sessions[1], `friendRequests/${requestId}`, 'DELETE')).status, 403)
            // Existing incoming/outgoing queries remain authorized under the tighter read rule.
            const query = { structuredQuery: { from: [{ collectionId: 'friendRequests' }], where: { fieldFilter: { field: { fieldPath: 'toUserId' }, op: 'EQUAL', value: str(b) } } } }
            assert.equal((await call(sessions[1], ':runQuery', 'POST', query)).status, 200)
        })
        await t.test('only recipient can accept; acceptance and unfriending update both sides', async () => {
            await assert.rejects(respondToFriendRequest(a, requestId, 'accept'), /Unauthorized/)
            await assert.rejects(respondToFriendRequest(outsider, requestId, 'ignore'), /Unauthorized/)
            await respondToFriendRequest(b, requestId, 'accept')
            assert.equal((await friendship(a, b).get()).exists, true)
            assert.equal((await friendship(b, a).get()).exists, true)
            assert.equal((await requestRef.get()).exists, false)
            assert.equal((await call(sessions[0], `users/${a}/friends/${b}`, 'DELETE')).status, 403)
            assert.equal((await call(sessions[2], `users/${a}/friends/${outsider}`, 'PATCH', { fields: { friendUserId: str(outsider) } })).status, 403)
            await removeFriend(outsider, a)
            assert.equal((await friendship(a, b).get()).exists, true)
            await removeFriend(a, b)
            assert.equal((await friendship(a, b).get()).exists, false)
            assert.equal((await friendship(b, a).get()).exists, false)
            await requestRef.set({ fromUserId: a, toUserId: b })
            await respondToFriendRequest(b, requestId, 'ignore')
            assert.equal((await requestRef.get()).exists, false)
            assert.equal((await friendship(a, b).get()).exists, false)
        })
    } finally {
        await requestRef.delete()
        await Promise.all(sessions.map(async session => {
            await db.recursiveDelete(userRef(session.localId))
            await db.collection('userStats').doc(session.localId).delete()
            await auth.deleteUser(session.localId)
        }))
    }
})
