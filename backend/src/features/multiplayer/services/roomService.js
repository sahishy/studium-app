import { deleteQueueEntry } from '../repositories/matchmakingRepository.js'
import { deleteRoom, deleteRoomPlayer, getRoomById, updateRoomPlayerIds } from '../repositories/roomRepository.js'
import { setSessionState } from '../repositories/sessionRepository.js'
import { db } from '../../../lib/firebaseAdmin.js'
import { sendRoomSystemMessage } from './chatService.js'
import { MULTIPLAYER_MODE_IDS } from '../utils/multiplayerUtils.js'
import { endSatClassicGameInTransaction } from '../games/sat-classic/services/satClassicService.js'

const prefetchUserStatsByUserId = async ({ playerIds = [], transaction }) => {

    if(!playerIds.length || !transaction) {
        return {}
    }

    const userStatsRefs = playerIds.map((playerId) => db.collection('userStats').doc(playerId))
    const userStatsSnaps = await Promise.all(userStatsRefs.map((ref) => transaction.get(ref)))

    const userStatsByUserId = {}
    playerIds.forEach((playerId, index) => {
        const snap = userStatsSnaps[index]
        userStatsByUserId[playerId] = snap.exists ? (snap.data() ?? {}) : {}
    })

    return userStatsByUserId

}

const trySatClassicLeaveRoomCallback = async ({ room, roomId, remainingPlayerIds = [], transaction, now, userStatsByUserId = {} }) => {

    const roomState = room?.state ?? {}
    const isActiveSatClassicMatch = room?.status === 'active' && roomState?.phase !== 'finished'

    if(!isActiveSatClassicMatch || remainingPlayerIds.length !== 1) {
        return
    }

    const winnerUserId = remainingPlayerIds[0]
    const roomPlayerIds = Array.isArray(room?.playerIds) ? room.playerIds.filter(Boolean) : []

    await endSatClassicGameInTransaction({
        transaction,
        roomId,
        roomData: room,
        playerIds: roomPlayerIds,
        winnerUserId,
        endReason: 'player_left',
        now,
        userStatsByUserId,
    })

}

const tryLeaveRoomCallbacks = async ({ room, roomId, userId, remainingPlayerIds = [], transaction, now, userStatsByUserId = {} }) => {

    if(!room || !roomId || !userId || !transaction) {
        return
    }

    const leaveCallbacksByMode = {
        [MULTIPLAYER_MODE_IDS.SAT_CLASSIC]: trySatClassicLeaveRoomCallback,
    }

    const leaveCallback = leaveCallbacksByMode[room.modeId]
    if(!leaveCallback) {
        return
    }

    await leaveCallback({
        room,
        roomId,
        userId,
        remainingPlayerIds,
        transaction,
        now,
        userStatsByUserId,
    })

}

const leaveRoom = async ({ roomId, userId }) => {

    if(!roomId || !userId) {
        throw new Error('roomId and userId are required to leave room.')
    }

    const shouldCleanupSubcollections = await db.runTransaction(async (transaction) => {

        const room = await getRoomById({ roomId, transaction })

        const roomPlayerRef = db.collection('multiplayerRooms').doc(roomId).collection('players').doc(userId)
        const roomPlayerSnap = await transaction.get(roomPlayerRef)

        const roomPlayerIds = Array.isArray(room?.playerIds) ? room.playerIds.filter(Boolean) : []
        const userStatsByUserId = await prefetchUserStatsByUserId({ playerIds: roomPlayerIds, transaction })

        const now = new Date()
        const leaverDisplayName = roomPlayerSnap.data()?.displayName || 'A player'
        const currentPlayerIds = Array.isArray(room?.playerIds) ? room.playerIds : []
        const remainingPlayerIds = currentPlayerIds.filter((playerId) => playerId && playerId !== userId)

        if(room) {
            await sendRoomSystemMessage({
                roomId,
                text: `${leaverDisplayName} has left the game.`,
                transaction,
                createdAt: now,
            })
        }

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

        await tryLeaveRoomCallbacks({
            room,
            roomId,
            userId,
            remainingPlayerIds,
            transaction,
            now,
            userStatsByUserId,
        })

        if(remainingPlayerIds.length === 0) {
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
        await deleteRoom({ roomId })
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