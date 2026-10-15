import { onDocumentDeleted } from 'firebase-functions/v2/firestore'
import { db } from '../../lib/firebaseAdmin.js'
export const clearDeletedCirclePrimary = onDocumentDeleted({document:'circles/{circleId}',retry:true}, async event => {
    const circleId = event.params.circleId
    const [primary, indexed] = await Promise.all([
        db.collection('users').where('primaryCircleId','==',circleId).get(),
        db.collection('users').where('circleMemberships.ids','array-contains',circleId).get(),
    ])
    const users = [...new Map([...primary.docs,...indexed.docs].map(u=>[u.id,u])).values()]
    await Promise.all(users.map(user => db.runTransaction(async tx => {
        const current = await tx.get(user.ref)
        if(!current.exists) return
        const patch = {}
        if(current.data().primaryCircleId === circleId) patch.primaryCircleId = null
        const membership = current.data().circleMemberships
        if(membership?.ids?.includes(circleId)) patch.circleMemberships = { ...membership, ids: membership.ids.filter(id=>id!==circleId) }
        if(Object.keys(patch).length) tx.update(user.ref,patch)
    })))
})
