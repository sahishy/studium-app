import { deleteQueueEntry } from '../repositories/matchmakingRepository.js'
import { deleteRefsBatch, deleteRoom, deleteRoomPlayer, getRoomById, getRoomPlayersSubcollectionRefs, updateRoomPlayerIds } from '../repositories/roomRepository.js'
import { setSessionState } from '../repositories/sessionRepository.js'
import { db } from '../../../lib/firebaseAdmin.js'
import { clearRoomEvents } from './roomEventsService.js'

const leaveRoom = async ({ roomId, userId }) => {

    if(!roomId || !userId) {
        throw new Error('roomId and userId are required to leave room.')
    }

    const shouldCleanupSubcollections = await db.runTransaction(async (transaction) => {

        const room = await getRoomById({ roomId, transaction })
        const now = new Date()

        deleteQueueEntry({ userId, transaction })
        deleteRoomPlayer({ roomId, userId, transaction })
        setSessionState({
            userId,
            status: 'idle',
            modeId: null,
            currentRoomId: null,
            updatedAt: now,
            transaction,
        })

        if(!room) {
            return false
        }

        const currentPlayerIds = Array.isArray(room.playerIds) ? room.playerIds : []
        const remainingPlayerIds = currentPlayerIds.filter((playerId) => playerId && playerId !== userId)

        if(remainingPlayerIds.length === 0) {
            deleteRoom({ roomId, transaction })
            return true
        }

        updateRoomPlayerIds({
            roomId,
            playerIds: remainingPlayerIds,
            updatedAt: now,
            transaction,
        })

        return false

    })

    if(shouldCleanupSubcollections) {
        const playerRefs = await getRoomPlayersSubcollectionRefs({ roomId })

        await Promise.all([
            deleteRefsBatch({ refs: playerRefs }),
            clearRoomEvents({ roomId }),
        ])
    }

    return { ok: true }

}

const deleteRoomById = async ({ roomId, playerIds = [] }) => {

    if(!roomId) {
        throw new Error('roomId is required to delete room.')
    }

    const room = await getRoomById({ roomId })
    const resolvedPlayerIds = playerIds.length
        ? playerIds
        : (room?.playerIds ?? [])

    const playerRefs = await getRoomPlayersSubcollectionRefs({ roomId })

    await Promise.all([
        deleteRefsBatch({ refs: playerRefs }),
        clearRoomEvents({ roomId }),
    ])

    await deleteRoom({ roomId })

    for(const playerId of resolvedPlayerIds) {
        if(!playerId) {
            continue
        }

        await deleteQueueEntry({ userId: playerId })
        await setSessionState({
            userId: playerId,
            status: 'idle',
            modeId: null,
            currentRoomId: null,
            updatedAt: new Date(),
        })
    }

    return { ok: true }

}

export {
    leaveRoom,
    deleteRoomById,
}
