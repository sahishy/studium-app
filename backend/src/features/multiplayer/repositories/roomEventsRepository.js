import { db } from '../../../lib/firebaseAdmin.js'

const ROOMS_COLLECTION = 'multiplayerRooms'

const createRoomEvent = async ({ roomId, event, transaction = null }) => {

    const eventRef = db.collection(ROOMS_COLLECTION).doc(roomId).collection('events').doc()

    if(transaction) {
        transaction.set(eventRef, event)
        return eventRef.id
    }

    await eventRef.set(event)
    return eventRef.id

}

const getRoomEventsSubcollectionRefs = async ({ roomId }) => {

    const eventsSnap = await db.collection(ROOMS_COLLECTION).doc(roomId).collection('events').get()
    return eventsSnap.docs.map((docSnap) => docSnap.ref)

}

export {
    createRoomEvent,
    getRoomEventsSubcollectionRefs,
}
