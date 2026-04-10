import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    limit,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    setDoc,
    writeBatch,
    where,
} from 'firebase/firestore'

const MATCHMAKING_COLLECTION = 'multiplayerMatchmaking'
const ROOMS_COLLECTION = 'multiplayerRooms'
const SESSIONS_COLLECTION = 'multiplayerSessions'

const joinRoom = async ({ roomId, userId, joinedAt = new Date(), joinerName = 'A player', transaction = null, db: providedDb = null }) => {

    if(!roomId || !userId) {
        throw new Error('roomId and userId are required to join a room.')
    }

    const db = providedDb ?? getFirestore()

    const applyJoin = async (activeTransaction) => {
        const roomPlayerRef = doc(db, ROOMS_COLLECTION, roomId, 'players', userId)
        activeTransaction.set(roomPlayerRef, {
            userId,
            state: {},
        })

        const roomChatMessageRef = doc(collection(db, ROOMS_COLLECTION, roomId, 'chat'))

        activeTransaction.set(roomChatMessageRef, {
            messageType: 'server',
            text: `${joinerName?.trim() || 'A player'} has joined the game.`,
            createdAt: joinedAt,
        })
    }

    if(transaction) {
        await applyJoin(transaction)
        return
    }

    await runTransaction(db, async (transactionRef) => {
        await applyJoin(transactionRef)
    })

}

const joinQueue = async ({ userId, modeId, elo = 0, displayName = 'A player' }) => {

    if(!userId || !modeId) {
        throw new Error('userId and modeId are required to join queue.')
    }

    const db = getFirestore()
    const now = new Date()
    const matchmakingRef = doc(db, MATCHMAKING_COLLECTION, userId)
    const sessionRef = doc(db, SESSIONS_COLLECTION, userId)
    const batch = writeBatch(db)

    batch.set(matchmakingRef, {
        userId,
        displayName: displayName?.trim() || 'A player',
        modeId,
        elo: Number(elo) || 0,
        queuedAt: now,
    })

    batch.set(sessionRef, {
        userId,
        status: 'queue',
        modeId,
        currentRoomId: null,
        updatedAt: now,
    }, { merge: true })

    await batch.commit()

}

const cancelQueue = async ({ userId }) => {

    if(!userId) {
        throw new Error('userId is required to cancel queue.')
    }

    const db = getFirestore()
    const matchmakingRef = doc(db, MATCHMAKING_COLLECTION, userId)
    const sessionRef = doc(db, SESSIONS_COLLECTION, userId)

    const batch = writeBatch(db)
    batch.delete(matchmakingRef)
    batch.set(sessionRef, {
        userId,
        status: 'idle',
        modeId: null,
        currentRoomId: null,
        updatedAt: new Date(),
    }, { merge: true })

    await batch.commit()

}

const leaveRoom = async ({ roomId, userId, leaverName = null }) => {

    if(!roomId || !userId) {
        throw new Error('roomId and userId are required to leave a room.')
    }

    const db = getFirestore()
    const roomRef = doc(db, ROOMS_COLLECTION, roomId)
    const roomPlayerRef = doc(db, ROOMS_COLLECTION, roomId, 'players', userId)
    const matchmakingRef = doc(db, MATCHMAKING_COLLECTION, userId)
    const sessionRef = doc(db, SESSIONS_COLLECTION, userId)
    const roomChatRef = collection(db, ROOMS_COLLECTION, roomId, 'chat')

    const shouldCleanupRoomSubcollections = await runTransaction(db, async (transaction) => {
        const roomSnap = await transaction.get(roomRef)
        const now = new Date()

        transaction.delete(matchmakingRef)
        transaction.delete(roomPlayerRef)
        transaction.set(sessionRef, {
            userId,
            status: 'idle',
            modeId: null,
            currentRoomId: null,
            updatedAt: now,
        }, { merge: true })

        if(!roomSnap.exists()) {
            return false
        }

        const roomData = roomSnap.data() ?? {}
        const currentPlayerIds = Array.isArray(roomData.playerIds) ? roomData.playerIds : []
        const remainingPlayerIds = currentPlayerIds.filter((playerId) => playerId && playerId !== userId)

        if(remainingPlayerIds.length > 0) {
            const serverMessageRef = doc(roomChatRef)
            const resolvedLeaverName = leaverName?.trim() || 'A player'

            transaction.set(serverMessageRef, {
                messageType: 'server',
                text: `${resolvedLeaverName} has left the game.`,
                createdAt: now,
            })
        }

        if(remainingPlayerIds.length === 0) {
            transaction.delete(roomRef)
            return true
        }

        transaction.set(roomRef, {
            playerIds: remainingPlayerIds,
            updatedAt: now,
        }, { merge: true })

        return false
    })

    if(shouldCleanupRoomSubcollections) {
        const subcollections = ['players', 'events', 'chat']

        for(const subcollectionName of subcollections) {

            const subcollectionRef = collection(db, ROOMS_COLLECTION, roomId, subcollectionName)
            const subcollectionSnap = await getDocs(subcollectionRef)

            if(subcollectionSnap.empty) {
                continue
            }

            const batch = writeBatch(db)
            subcollectionSnap.docs.forEach((docSnap) => {
                batch.delete(docSnap.ref)
            })
            await batch.commit()
        }
    }

}

const deleteRoom = async ({ roomId, playerIds = [] }) => {
    
    if(!roomId) {
        throw new Error('roomId is required to delete a room.')
    }

    const db = getFirestore()
    const subcollections = ['players', 'events', 'chat']

    for(const subcollectionName of subcollections) {

        const subcollectionRef = collection(db, ROOMS_COLLECTION, roomId, subcollectionName)
        const subcollectionSnap = await getDocs(subcollectionRef)

        if(subcollectionSnap.empty) {
            continue
        }

        const batch = writeBatch(db)
        subcollectionSnap.docs.forEach((docSnap) => {
            batch.delete(docSnap.ref)
        })
        await batch.commit()

    }

    const roomRef = doc(db, ROOMS_COLLECTION, roomId)
    const roomSnap = await getDoc(roomRef)
    const resolvedPlayerIds = playerIds.length
        ? playerIds
        : (roomSnap.exists() ? (roomSnap.data()?.playerIds ?? []) : [])

    await deleteDoc(roomRef)

    if(resolvedPlayerIds.length) {

        const batch = writeBatch(db)
        resolvedPlayerIds.forEach((playerId) => {
            if(playerId) {
                batch.delete(doc(db, MATCHMAKING_COLLECTION, playerId))
                batch.set(doc(db, SESSIONS_COLLECTION, playerId), {
                    userId: playerId,
                    status: 'idle',
                    modeId: null,
                    currentRoomId: null,
                    updatedAt: new Date(),
                }, { merge: true })
            }
        })
        await batch.commit()

    }

}

const subscribeToMatchmakingByUserId = ( userId, onChange, setLoading = () => {}, setError = () => {} ) => {

    if(!userId) {
        onChange?.(null)
        setLoading(false)
        return () => {}
    }

    const db = getFirestore()
    const matchmakingRef = doc(db, MATCHMAKING_COLLECTION, userId)

    return onSnapshot(matchmakingRef, (docSnap) => {
        onChange?.(docSnap.exists()
            ? { uid: docSnap.id, ...docSnap.data() }
            : null)
        setError(null)
        setLoading(false)
    }, (error) => {
        setError(error)
        setLoading(false)
    })

}

const subscribeToSessionByUserId = ( userId, onChange, setLoading = () => {}, setError = () => {} ) => {

    if(!userId) {
        onChange?.(null)
        setLoading(false)
        return () => {}
    }

    const db = getFirestore()
    const sessionRef = doc(db, SESSIONS_COLLECTION, userId)

    return onSnapshot(sessionRef, (docSnap) => {
        onChange?.(docSnap.exists()
            ? { uid: docSnap.id, ...docSnap.data() }
            : null)
        setError(null)
        setLoading(false)
    }, (error) => {
        setError(error)
        setLoading(false)
    })

}

const subscribeToRoomById = ( roomId, onChange, setLoading = () => {}, setError = () => {} ) => {

    if(!roomId) {
        onChange?.(null)
        setLoading(false)
        return () => {}
    }

    const db = getFirestore()
    const roomRef = doc(db, ROOMS_COLLECTION, roomId)

    return onSnapshot(roomRef, (docSnap) => {
        onChange?.(docSnap.exists()
            ? { uid: docSnap.id, ...docSnap.data() }
            : null)
        setError(null)
        setLoading(false)
    }, (error) => {
        setError(error)
        setLoading(false)
    })

}

const subscribeToRoomChat = ( roomId, onChange, setLoading = () => {}, setError = () => {} ) => {

    if(!roomId) {
        onChange?.([])
        setLoading(false)
        return () => {}
    }

    const db = getFirestore()
    const chatRef = collection(db, ROOMS_COLLECTION, roomId, 'chat')
    const chatQuery = query(chatRef, orderBy('createdAt', 'asc'))

    return onSnapshot(chatQuery, (snapshot) => {
        onChange?.(snapshot.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() })))
        setError(null)
        setLoading(false)
    }, (error) => {
        setError(error)
        setLoading(false)
    })

}

const subscribeToRoomPlayers = ( roomId, onChange, setLoading = () => {}, setError = () => {} ) => {

    if(!roomId) {
        onChange?.([])
        setLoading(false)
        return () => {}
    }

    const db = getFirestore()
    const playersRef = collection(db, ROOMS_COLLECTION, roomId, 'players')

    return onSnapshot(playersRef, (snapshot) => {
        onChange?.(snapshot.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() })))
        setError(null)
        setLoading(false)
    }, (error) => {
        setError(error)
        setLoading(false)
    })

}

const setRoomPlayerState = async ({ roomId, userId, state = {} }) => {

    if(!roomId || !userId) {
        throw new Error('roomId and userId are required to set room player state.')
    }

    if(!state || typeof state !== 'object') {
        throw new Error('state must be an object when setting room player state.')
    }

    const db = getFirestore()
    const roomPlayerRef = doc(db, ROOMS_COLLECTION, roomId, 'players', userId)

    await setDoc(roomPlayerRef, {
        userId,
        ...Object.fromEntries(Object.entries(state).map(([key, value]) => [`state.${key}`, value])),
    }, { merge: true })
}

const sendRoomChatMessage = async ({ roomId, userId = null, text, senderName = null, clientMessageId = null, messageType = 'user' }) => {

    if(!roomId || !text?.trim()) {
        throw new Error('roomId and non-empty text are required to send a chat message.')
    }

    if(messageType === 'user' && !userId) {
        throw new Error('userId is required for user chat messages.')
    }

    const db = getFirestore()
    const messageRef = doc(collection(db, ROOMS_COLLECTION, roomId, 'chat'))

    await setDoc(messageRef, {
        userId,
        senderName,
        messageType,
        text: text.trim(),
        clientMessageId,
        createdAt: new Date(),
    })

}

const tryMatchmake = async ({ userId, modeId }) => {

    if(!userId || !modeId) {
        return { matched: false, roomId: null }
    }

    const db = getFirestore()
    const matchmakingRef = collection(db, MATCHMAKING_COLLECTION)
    const candidateQuery = query(
        matchmakingRef,
        where('modeId', '==', modeId),
        orderBy('queuedAt', 'asc'),
        limit(20),
    )

    const candidateSnap = await getDocs(candidateQuery)
    const candidateDoc = candidateSnap.docs.find((docSnap) => docSnap.id !== userId)

    if(!candidateDoc) {
        return { matched: false, roomId: null }
    }

    const ownMatchRef = doc(db, MATCHMAKING_COLLECTION, userId)
    const opponentMatchRef = doc(db, MATCHMAKING_COLLECTION, candidateDoc.id)
    const roomRef = doc(collection(db, ROOMS_COLLECTION))

    const result = await runTransaction(db, async (transaction) => {
        const [ownSnap, opponentSnap] = await Promise.all([
            transaction.get(ownMatchRef),
            transaction.get(opponentMatchRef),
        ])

        if(!ownSnap.exists() || !opponentSnap.exists()) {
            return { matched: false, roomId: null }
        }

        const ownData = ownSnap.data()
        const opponentData = opponentSnap.data()

        const bothQueueing = (
            ownData?.modeId === modeId
            && opponentData?.modeId === modeId
        )

        if(!bothQueueing) {
            return { matched: false, roomId: null }
        }

        const now = new Date()
        const playerIds = [userId, candidateDoc.id]
        const playerDisplayNames = [
            ownData?.displayName?.trim() || 'A player',
            opponentData?.displayName?.trim() || 'A player',
        ]

        transaction.set(roomRef, {
            modeId,
            status: 'active',
            createdAt: now,
            startedAt: now,
            playerIds,
            turnIndex: 0,
            currentActorId: null,
            winnerId: null,
            questionSetId: null,
            state: {},
        })

        for(const [index, playerId] of playerIds.entries()) {
            await joinRoom({
                roomId: roomRef.id,
                userId: playerId,
                joinedAt: now,
                joinerName: playerDisplayNames[index],
                transaction,
                db,
            })
        }

        transaction.delete(ownMatchRef)
        transaction.delete(opponentMatchRef)

        const ownSessionRef = doc(db, SESSIONS_COLLECTION, userId)
        const opponentSessionRef = doc(db, SESSIONS_COLLECTION, candidateDoc.id)

        transaction.set(ownSessionRef, {
            userId,
            status: 'in_room',
            modeId,
            currentRoomId: roomRef.id,
            updatedAt: now,
        }, { merge: true })

        transaction.set(opponentSessionRef, {
            userId: candidateDoc.id,
            status: 'in_room',
            modeId,
            currentRoomId: roomRef.id,
            updatedAt: now,
        }, { merge: true })

        return { matched: true, roomId: roomRef.id }
    })

    return result

}

export {
    joinQueue,
    cancelQueue,
    joinRoom,
    leaveRoom,
    deleteRoom,
    setRoomPlayerState,
    sendRoomChatMessage,
    subscribeToMatchmakingByUserId,
    subscribeToRoomChat,
    subscribeToRoomById,
    subscribeToRoomPlayers,
    subscribeToSessionByUserId,
    tryMatchmake,
}
