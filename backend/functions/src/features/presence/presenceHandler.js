import { onValueWritten } from 'firebase-functions/v2/database'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../../lib/firebaseAdmin.js'

const dayNumber = (dateString) => Math.floor(new Date(`${dateString}T00:00:00Z`).getTime() / 86400000)
const utcDateString = (date) => date.toISOString().slice(0, 10)

const handlePresenceChange = onValueWritten({ ref: '/status/{uid}' }, async (event) => {

    const uid = event.params.uid
    const before = event.data.before.val()
    const after = event.data.after.val()

    if(before?.state === after?.state) {
        return
    }

    const userRef = db.collection('users').doc(uid)

    if(after?.state !== 'online') {
        await userRef.set({ status: 'inactive', lastSeen: FieldValue.serverTimestamp() }, { merge: true })
        return
    }

    // Streak evaluation lives here (rather than a separate function) so the read of the
    // *previous* lastSeen and the write of the *new* lastSeen happen in one transaction -
    // otherwise a separate presence-mirroring function racing this one could overwrite
    // lastSeen to "now" before the day-diff is computed, breaking the streak math.
    await db.runTransaction(async (transaction) => {

        const userSnap = await transaction.get(userRef)
        const lastSeen = userSnap.data()?.lastSeen?.toDate?.() ?? null

        const todayUtc = utcDateString(new Date())
        const daysDiff = lastSeen ? dayNumber(todayUtc) - dayNumber(utcDateString(lastSeen)) : null

        const update = { status: 'active', lastSeen: FieldValue.serverTimestamp() }
        if(!userSnap.data()?.activity) update.activity = { state: 'online', updatedAt: FieldValue.serverTimestamp() }

        if(daysDiff === 1) {
            update.progress = { streak: FieldValue.increment(1) }
        } else if(daysDiff !== 0) {
            // Either a multi-day gap, or no prior lastSeen at all (new user) - start over.
            update.progress = { streak: 0 }
        }
        // daysDiff === 0: already evaluated today, leave progress.streak untouched. This is
        // what makes concurrent same-day triggers (multiple tabs/devices) idempotent - only
        // the first transaction to commit each day changes the streak.

        transaction.set(userRef, update, { merge: true })

    })

})

export { handlePresenceChange }
