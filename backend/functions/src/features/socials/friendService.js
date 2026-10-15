import { db } from '../../lib/firebaseAdmin.js'

const validId = (value) => {
    if(typeof value !== 'string' || !value || value.includes('/') || value.length > 128) throw new Error('Invalid user or request id.')
    return value
}
const friendRef = (uid, other) => db.collection('users').doc(uid).collection('friends').doc(other)

export const removeFriend = async (uid, targetUserId) => {
    validId(targetUserId)
    if(uid === targetUserId) throw new Error('Invalid friend.')
    const batch = db.batch()
    batch.delete(friendRef(uid, targetUserId))
    batch.delete(friendRef(targetUserId, uid))
    await batch.commit()
    return { ok: true }
}

export const respondToFriendRequest = async (uid, requestId, action) => {
    validId(requestId)
    if(!['accept', 'ignore'].includes(action)) throw new Error('Invalid friend request action.')
    return db.runTransaction(async tx => {
        const ref = db.collection('friendRequests').doc(requestId)
        const snapshot = await tx.get(ref)
        if(!snapshot.exists) throw new Error('Friend request is no longer available.')
        const { fromUserId, toUserId } = snapshot.data()
        if(toUserId !== uid) throw new Error('Unauthorized: only the recipient can respond.')
        validId(fromUserId)
        if(fromUserId === uid) throw new Error('Invalid friend request.')
        if(action === 'accept') {
            const sender = await tx.get(db.collection('users').doc(fromUserId))
            if(!sender.exists) throw new Error('This user is no longer available.')
            const now = new Date()
            tx.set(friendRef(uid, fromUserId), { friendUserId: fromUserId, createdAt: now })
            tx.set(friendRef(fromUserId, uid), { friendUserId: uid, createdAt: now })
        }
        tx.delete(ref)
        return { ok: true }
    })
}
