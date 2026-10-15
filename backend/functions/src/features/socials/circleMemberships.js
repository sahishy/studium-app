import { db } from '../../lib/firebaseAdmin.js'

const isIndexed = index => index?.version === 1 && Array.isArray(index.ids)

// Perform legacy discovery before opening the reward transaction. Mixing direct
// reads with transaction locks can deadlock a first request against a Circle update.
export const ensureMembershipIndex = async uid => {
    const userRef = db.collection('users').doc(uid)
    const user = await userRef.get()
    if(!user.exists || isIndexed(user.data().circleMemberships)) return
    const legacy = await db.collection('circles').get()
    const discovered = (await Promise.all(legacy.docs.map(async circle =>
        (await circle.ref.collection('members').doc(uid).get()).exists ? circle.ref : null))).filter(Boolean)
    await db.runTransaction(async tx => {
        const current = await tx.get(userRef)
        if(!current.exists || isIndexed(current.data().circleMemberships)) return
        const joined = await Promise.all(discovered.map(async ref => {
            const [circle, member] = await Promise.all([tx.get(ref),tx.get(ref.collection('members').doc(uid))])
            return circle.exists && member.exists ? ref.id : null
        }))
        tx.update(userRef, { circleMemberships: { version: 1, ids: joined.filter(Boolean) } })
    })
}

// Existing accounts are discovered once, then membership mutations maintain this index
// in the same transaction as the authoritative members documents.
export const readMemberships = async (reader, uid, userSnapshot = null) => {
    const userRef = db.collection('users').doc(uid)
    const user = userSnapshot ?? await reader.get(userRef)
    const index = user.data()?.circleMemberships
    if(!user.exists) return { userRef, circles: [], needsMigration: false }
    if(!isIndexed(index)) throw new Error('Initialize Circle memberships before starting the transaction.')
    const refs = [...new Set(index.ids)].map(id => db.collection('circles').doc(id))
    const records = await Promise.all(refs.map(async ref => {
        const [circle, member] = await Promise.all([
            reader.get(ref), reader.get(ref.collection('members').doc(uid)),
        ])
        return circle.exists && member.exists ? circle : null
    }))
    const circles = records.filter(Boolean)
    return {
        userRef, circles,
        needsMigration: circles.length !== index.ids.length,
    }
}

export const writeMembershipIndex = (tx, membership) => {
    if(membership.needsMigration) tx.update(membership.userRef, {
        circleMemberships: { version: 1, ids: membership.circles.map(circle => circle.id) },
    })
}
