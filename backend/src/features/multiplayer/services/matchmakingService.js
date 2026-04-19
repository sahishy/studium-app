import { db } from '../../../lib/firebaseAdmin.js'
import { createQueueEntry, deleteQueueEntry, getQueueCandidatesByMode, getQueueEntryByUserId } from '../repositories/matchmakingRepository.js'
import { createRoom, createRoomPlayer } from '../repositories/roomRepository.js'
import { setSessionState } from '../repositories/sessionRepository.js'
import { addRoomEvent } from './roomEventsService.js'
import { sendRoomSystemMessage } from './chatService.js'
import { initializeSatClassicRoomState } from '../games/sat-classic/services/satClassicService.js'
import { MULTIPLAYER_MODE_IDS, isSupportedMultiplayerMode } from '../utils/multiplayerUtils.js'

const initializeGameByMode = async ({ modeId, roomId, playerIds, transaction, now }) => {

    const modeInitializers = {
        [MULTIPLAYER_MODE_IDS.SAT_CLASSIC]: async () => {
            const initializationEvent = initializeSatClassicRoomState({
                roomId,
                playerIds,
                transaction,
                now,
            })

            await addRoomEvent({
                roomId,
                type: initializationEvent.type,
                modeId: initializationEvent.modeId,
                actorUserId: initializationEvent.actorUserId,
                sequence: initializationEvent.sequence,
                data: initializationEvent.data,
                transaction,
            })
        },
    }

    const initializer = modeInitializers[modeId]
    if(!initializer) {
        return
    }

    await initializer()

}

const joinQueue = async ({ userId, modeId, elo = 0, displayName = 'A player', profilePicture = null }) => {

    if(!userId || !modeId) {
        throw new Error('userId and modeId are required to join queue.')
    }

    if(!isSupportedMultiplayerMode(modeId)) {
        throw new Error(`Unsupported multiplayer mode: ${modeId}`)
    }

    const existingEntry = await getQueueEntryByUserId({ userId })

    if(!existingEntry) {
        await createQueueEntry({ userId, modeId, elo, displayName, profilePicture })
    }

    await setSessionState({
        userId,
        status: 'queue',
        modeId,
        currentRoomId: null,
    })

    return { ok: true }

}

const leaveQueue = async ({ userId }) => {

    if(!userId) {
        throw new Error('userId is required to leave queue.')
    }

    await deleteQueueEntry({ userId })
    await setSessionState({
        userId,
        status: 'idle',
        modeId: null,
        currentRoomId: null,
    })

    return { ok: true }

}

const attemptMatchmake = async ({ userId, modeId }) => {

    if(!userId || !modeId) {
        return { matched: false, roomId: null }
    }

    if(!isSupportedMultiplayerMode(modeId)) {
        return { matched: false, roomId: null }
    }

    const candidates = await getQueueCandidatesByMode({ modeId, limit: 20 })
    const opponent = candidates.find((candidate) => candidate.id !== userId)

    if(!opponent) {
        return { matched: false, roomId: null }
    }

    return db.runTransaction(async (transaction) => {
        const ownQueueEntry = await getQueueEntryByUserId({ userId, transaction })
        const opponentQueueEntry = await getQueueEntryByUserId({ userId: opponent.id, transaction })

        if(!ownQueueEntry || !opponentQueueEntry) {
            return { matched: false, roomId: null }
        }

        if(ownQueueEntry.modeId !== modeId || opponentQueueEntry.modeId !== modeId) {
            return { matched: false, roomId: null }
        }

        const now = new Date()
        const playerIds = [userId, opponent.id]
        const roomId = createRoom({
            modeId,
            playerIds,
            createdAt: now,
            startedAt: now,
            updatedAt: now,
            transaction,
        })

        createRoomPlayer({
            roomId,
            userId,
            displayName: ownQueueEntry.displayName || 'A player',
            profilePicture: ownQueueEntry.profilePicture ?? null,
            transaction,
        })

        createRoomPlayer({
            roomId,
            userId: opponent.id,
            displayName: opponentQueueEntry.displayName || 'A player',
            profilePicture: opponentQueueEntry.profilePicture ?? null,
            transaction,
        })

        await sendRoomSystemMessage({
            roomId,
            text: `${ownQueueEntry.displayName || 'A player'} has joined the game.`,
            transaction,
            createdAt: now,
        })

        await sendRoomSystemMessage({
            roomId,
            text: `${opponentQueueEntry.displayName || 'A player'} has joined the game.`,
            transaction,
            createdAt: now,
        })

        await initializeGameByMode({
            modeId,
            roomId,
            playerIds,
            transaction,
            now,
        })

        await deleteQueueEntry({ userId, transaction })
        await deleteQueueEntry({ userId: opponent.id, transaction })

        await setSessionState({
            userId,
            status: 'in_room',
            modeId,
            currentRoomId: roomId,
            updatedAt: now,
            transaction,
        })

        await setSessionState({
            userId: opponent.id,
            status: 'in_room',
            modeId,
            currentRoomId: roomId,
            updatedAt: now,
            transaction,
        })

        return { matched: true, roomId }

    })
    
}

export {
    joinQueue,
    leaveQueue,
    attemptMatchmake,
}
