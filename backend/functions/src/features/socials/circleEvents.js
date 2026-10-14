import { onDocumentDeleted } from 'firebase-functions/v2/firestore'
import { db } from '../../lib/firebaseAdmin.js'
export const clearDeletedCirclePrimary = onDocumentDeleted({document:'circles/{circleId}',retry:true}, async event => {
    const users = await db.collection('users').where('primaryCircleId','==',event.params.circleId).get()
    await Promise.all(users.docs.map(user => db.runTransaction(async tx => {
        const current = await tx.get(user.ref)
        if(current.data()?.primaryCircleId === event.params.circleId) tx.update(user.ref,{primaryCircleId:null})
    })))
})
