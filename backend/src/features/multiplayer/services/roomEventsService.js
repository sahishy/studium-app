import { createRoomEvent, getRoomEventsSubcollectionRefs } from '../repositories/roomEventsRepository.js'
import { deleteRefsBatch } from '../repositories/roomRepository.js'

const addRoomEvent = async ({ roomId, type, modeId = null, actorUserId = null, sequence, data = {}, transaction = null }) => {

    if(!roomId || !type) {
        throw new Error('roomId and type are required to append a room event.')
    }

    if(!Number.isFinite(sequence)) {
        throw new Error('A numeric sequence is required to append a room event.')
    }

    return createRoomEvent({
        roomId,
        transaction,
        event: {
            type,
            modeId,
            actorUserId,
            sequence,
            data,
            createdAt: new Date(),
        },
    })

}

const clearRoomEvents = async ({ roomId }) => {

    const eventRefs = await getRoomEventsSubcollectionRefs({ roomId })
    await deleteRefsBatch({ refs: eventRefs })
    
}

export {
    addRoomEvent,
    clearRoomEvents,
}
