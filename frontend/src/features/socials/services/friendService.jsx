import { addDoc, collection, deleteDoc, doc, documentId, getDocs, limit, onSnapshot, query, where, writeBatch } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../../../lib/firebase'
import { getUserByDisplayName } from '../../auth/services/userService'
import { normalizeFriendSearchInput } from '../utils/friendUtils'

const getFriendDocRef = (userId, friendUserId) => {
    return doc(db, 'users', userId, 'friends', friendUserId)
}

const sendFriendRequestByUserId = async (currentUserId, targetUserId) => {

    if(!currentUserId || !targetUserId) {
        throw new Error('Missing user ids.')
    }

    if(targetUserId === currentUserId) {
        throw new Error("You can't add yourself.")
    }

    const existingFriendSnap = await getDocs(
        query(
            collection(db, 'users', currentUserId, 'friends'),
            where(documentId(), '==', targetUserId),
            limit(1)
        )
    )
    if(!existingFriendSnap.empty) {
        throw new Error('You are already friends.')
    }

    const existingOutgoingRequest = await getDocs(
        query(
            collection(db, 'friendRequests'),
            where('fromUserId', '==', currentUserId),
            where('toUserId', '==', targetUserId),
            limit(1)
        )
    )

    if(!existingOutgoingRequest.empty) {
        throw new Error('Friend request already sent.')
    }

    const existingIncomingRequest = await getDocs(
        query(
            collection(db, 'friendRequests'),
            where('fromUserId', '==', targetUserId),
            where('toUserId', '==', currentUserId),
            limit(1)
        )
    )

    if(!existingIncomingRequest.empty) {
        throw new Error('This user already sent you a friend request.')
    }

    await addDoc(collection(db, 'friendRequests'), {
        fromUserId: currentUserId,
        toUserId: targetUserId,
        createdAt: new Date(),
    })

}

const sendFriendRequestByUsername = async (currentUserId, usernameInput) => {

    const username = normalizeFriendSearchInput(usernameInput)

    if(!currentUserId) {
        throw new Error('Missing current user.')
    }
    if(!username) {
        throw new Error('Enter a username.')
    }

    const targetUser = await getUserByDisplayName(username)
    if(!targetUser?.uid) {
        throw new Error('User not found.')
    }

    await sendFriendRequestByUserId(currentUserId, targetUser.uid)

}

const removeFriend = async (currentUserId, targetUserId) => {

    if(!currentUserId || !targetUserId) {
        throw new Error('Missing user ids.')
    }

    const batch = writeBatch(db)
    batch.delete(getFriendDocRef(currentUserId, targetUserId))
    batch.delete(getFriendDocRef(targetUserId, currentUserId))
    await batch.commit()

}

const acceptFriendRequest = async ({ requestId, currentUserId, fromUserId }) => {

    if(!requestId || !currentUserId || !fromUserId) {
        throw new Error('Missing friend request metadata.')
    }

    const now = new Date()
    const batch = writeBatch(db)

    batch.set(getFriendDocRef(currentUserId, fromUserId), {
        friendUserId: fromUserId,
        createdAt: now,
    })

    batch.set(getFriendDocRef(fromUserId, currentUserId), {
        friendUserId: currentUserId,
        createdAt: now,
    })

    batch.delete(doc(db, 'friendRequests', requestId))
    await batch.commit()

}

const ignoreFriendRequest = async (requestId) => {

    if(!requestId) {
        throw new Error('Missing request id.')
    }

    await deleteDoc(doc(db, 'friendRequests', requestId))

}

const useFriendIds = (userId) => {

    const [friendIds, setFriendIds] = useState([])

    useEffect(() => {
        if(!userId) {
            setFriendIds([])
            return
        }

        const friendsRef = collection(db, 'users', userId, 'friends')
        const unsubscribe = onSnapshot(friendsRef, (snapshot) => {
            setFriendIds(snapshot.docs.map((friendDoc) => friendDoc.id))
        })

        return () => unsubscribe()
    }, [userId])

    return friendIds

}

const useIncomingFriendRequests = (userId) => {

    const [requests, setRequests] = useState([])

    useEffect(() => {
        if(!userId) {
            setRequests([])
            return
        }

        const requestsRef = collection(db, 'friendRequests')
        const incomingQuery = query(requestsRef, where('toUserId', '==', userId))

        const unsubscribe = onSnapshot(incomingQuery, (snapshot) => {
            const nextRequests = snapshot.docs.map((requestDoc) => ({
                uid: requestDoc.id,
                ...requestDoc.data(),
            }))

            setRequests(nextRequests)
        })

        return () => unsubscribe()
    }, [userId])

    return requests
    
}

const useIsFriend = (currentUserId, targetUserId) => {

    const [isFriend, setIsFriend] = useState(false)

    useEffect(() => {
        if(!currentUserId || !targetUserId || currentUserId === targetUserId) {
            setIsFriend(false)
            return
        }

        const friendDocRef = getFriendDocRef(currentUserId, targetUserId)
        const unsubscribe = onSnapshot(friendDocRef, (snapshot) => {
            setIsFriend(snapshot.exists())
        })

        return () => unsubscribe()
    }, [currentUserId, targetUserId])

    return isFriend

}

const useHasOutgoingFriendRequest = (currentUserId, targetUserId) => {

    const [hasOutgoingRequest, setHasOutgoingRequest] = useState(false)

    useEffect(() => {
        if(!currentUserId || !targetUserId || currentUserId === targetUserId) {
            setHasOutgoingRequest(false)
            return
        }

        const outgoingQuery = query(
            collection(db, 'friendRequests'),
            where('fromUserId', '==', currentUserId),
            where('toUserId', '==', targetUserId)
        )

        const unsubscribe = onSnapshot(outgoingQuery, (snapshot) => {
            setHasOutgoingRequest(!snapshot.empty)
        })

        return () => unsubscribe()
    }, [currentUserId, targetUserId])

    return hasOutgoingRequest

}

export {
    sendFriendRequestByUserId,
    sendFriendRequestByUsername,
    removeFriend,
    acceptFriendRequest,
    ignoreFriendRequest,
    useFriendIds,
    useIncomingFriendRequests,
    useIsFriend,
    useHasOutgoingFriendRequest,
}
