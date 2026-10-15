import { post } from '../../../shared/services/apiService'
import { addDoc, collection, doc, documentId, getDocs, limit, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../../../lib/firebase'
import { getUserByDisplayName } from '../../auth/services/userService'
import { normalizeFriendSearchInput } from '../utils/friendUtils'
import { CACHE_STATUS, createCacheKey, deleteCacheEntry, getCacheStatus, getCacheValue, setCacheEntry } from '../../../shared/services/cacheService'
import { CACHE_NAMESPACES, CACHE_TTLS_MS } from '../../../shared/utils/cacheUtils'

const FRIENDS_UPDATED_EVENT = 'socials:friends-updated'
const INCOMING_REQUESTS_UPDATED_EVENT = 'socials:incoming-friend-requests-updated'

const getFriendIdsCacheKey = (userId) => createCacheKey(CACHE_NAMESPACES.SOCIALS_FRIEND_IDS, userId)
const getIncomingFriendRequestsCacheKey = (userId) => createCacheKey(CACHE_NAMESPACES.SOCIALS_INCOMING_FRIEND_REQUESTS, userId)

const emitWindowEvent = (eventName) => {
    if(typeof window !== 'undefined') {
        window.dispatchEvent(new Event(eventName))
    }
}

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

    await post('/v1/friends/remove', { targetUserId })

    const currentUserCacheKey = getFriendIdsCacheKey(currentUserId)
    const targetUserCacheKey = getFriendIdsCacheKey(targetUserId)

    const currentCachedIds = getCacheValue(currentUserCacheKey)
    if(Array.isArray(currentCachedIds)) {
        setCacheEntry(currentUserCacheKey, currentCachedIds.filter((id) => id !== targetUserId), {
            ttlMs: CACHE_TTLS_MS.SOCIALS_FRIEND_IDS,
        })
    } else {
        deleteCacheEntry(currentUserCacheKey)
    }

    const targetCachedIds = getCacheValue(targetUserCacheKey)
    if(Array.isArray(targetCachedIds)) {
        setCacheEntry(targetUserCacheKey, targetCachedIds.filter((id) => id !== currentUserId), {
            ttlMs: CACHE_TTLS_MS.SOCIALS_FRIEND_IDS,
        })
    } else {
        deleteCacheEntry(targetUserCacheKey)
    }

    emitWindowEvent(FRIENDS_UPDATED_EVENT)

}

const acceptFriendRequest = async ({ requestId, currentUserId, fromUserId }) => {

    if(!requestId || !currentUserId || !fromUserId) {
        throw new Error('Missing friend request metadata.')
    }

    await post(`/v1/friend-requests/${encodeURIComponent(requestId)}/respond`, { action: 'accept' })

    deleteCacheEntry(getIncomingFriendRequestsCacheKey(currentUserId))

    const currentUserCacheKey = getFriendIdsCacheKey(currentUserId)
    const currentCachedIds = getCacheValue(currentUserCacheKey)
    if(Array.isArray(currentCachedIds)) {
        const nextIds = currentCachedIds.includes(fromUserId)
            ? currentCachedIds
            : [...currentCachedIds, fromUserId]
        setCacheEntry(currentUserCacheKey, nextIds, {
            ttlMs: CACHE_TTLS_MS.SOCIALS_FRIEND_IDS,
        })
    } else {
        deleteCacheEntry(currentUserCacheKey)
    }

    const fromUserCacheKey = getFriendIdsCacheKey(fromUserId)
    const fromUserCachedIds = getCacheValue(fromUserCacheKey)
    if(Array.isArray(fromUserCachedIds)) {
        const nextIds = fromUserCachedIds.includes(currentUserId)
            ? fromUserCachedIds
            : [...fromUserCachedIds, currentUserId]
        setCacheEntry(fromUserCacheKey, nextIds, {
            ttlMs: CACHE_TTLS_MS.SOCIALS_FRIEND_IDS,
        })
    } else {
        deleteCacheEntry(fromUserCacheKey)
    }

    emitWindowEvent(FRIENDS_UPDATED_EVENT)
    emitWindowEvent(INCOMING_REQUESTS_UPDATED_EVENT)

}

const ignoreFriendRequest = async (requestId) => {

    if(!requestId) {
        throw new Error('Missing request id.')
    }

    await post(`/v1/friend-requests/${encodeURIComponent(requestId)}/respond`, { action: 'ignore' })

    emitWindowEvent(INCOMING_REQUESTS_UPDATED_EVENT)

}

const useFriendIds = (userId) => {

    const [friendIds, setFriendIds] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if(!userId) {
            setFriendIds([])
            setLoading(false)
            return
        }

        const cacheKey = getFriendIdsCacheKey(userId)
        const cacheStatus = getCacheStatus(cacheKey)
        const cachedValue = getCacheValue(cacheKey)

        if(Array.isArray(cachedValue)) {
            setFriendIds(cachedValue)
        }
        setLoading(cacheStatus !== CACHE_STATUS.FRESH || !Array.isArray(cachedValue))

        let isMounted = true

        const fetchFriendIds = async () => {
            try {
                const friendsRef = collection(db, 'users', userId, 'friends')
                const snapshot = await getDocs(friendsRef)
                const nextFriendIds = snapshot.docs.map((friendDoc) => friendDoc.id)

                setCacheEntry(cacheKey, nextFriendIds, {
                    ttlMs: CACHE_TTLS_MS.SOCIALS_FRIEND_IDS,
                })

                if(!isMounted) return
                setFriendIds(nextFriendIds)
            } catch(error) {
                console.error('Could not load friends', error)
            } finally {
                if(isMounted) setLoading(false)
            }
        }

        if(cacheStatus !== CACHE_STATUS.FRESH || !Array.isArray(cachedValue)) {
            fetchFriendIds()
        }

        const handleFriendsUpdated = () => {
            fetchFriendIds()
        }

        window.addEventListener(FRIENDS_UPDATED_EVENT, handleFriendsUpdated)

        return () => {
            isMounted = false
            window.removeEventListener(FRIENDS_UPDATED_EVENT, handleFriendsUpdated)
        }
    }, [userId])

    return { friendIds, loading }

}

const useIncomingFriendRequests = (userId) => {

    const [requests, setRequests] = useState(null)

    useEffect(() => {
        if(!userId) {
            setRequests(null)
            return
        }

        const cacheKey = getIncomingFriendRequestsCacheKey(userId)
        const cacheStatus = getCacheStatus(cacheKey)
        const cachedValue = getCacheValue(cacheKey)

        if(Array.isArray(cachedValue)) {
            setRequests(cachedValue)
        }

        const requestsRef = collection(db, 'friendRequests')
        const incomingQuery = query(requestsRef, where('toUserId', '==', userId))

        const applySnapshot = (snapshot) => {
            const nextRequests = snapshot.docs.map((requestDoc) => ({
                uid: requestDoc.id,
                ...requestDoc.data(),
            }))

            setCacheEntry(cacheKey, nextRequests, {
                ttlMs: CACHE_TTLS_MS.SOCIALS_INCOMING_FRIEND_REQUESTS,
            })

            setRequests(nextRequests)
        }

        let fallbackFetchPromise = null
        if(cacheStatus !== CACHE_STATUS.FRESH) {
            fallbackFetchPromise = getDocs(incomingQuery).then(applySnapshot)
        }

        const unsubscribe = onSnapshot(incomingQuery, (snapshot) => {
            applySnapshot(snapshot)
        })

        const handleIncomingRequestsUpdated = async () => {
            const snapshot = await getDocs(incomingQuery)
            applySnapshot(snapshot)
        }

        window.addEventListener(INCOMING_REQUESTS_UPDATED_EVENT, handleIncomingRequestsUpdated)

        return () => {
            void fallbackFetchPromise
            unsubscribe()
            window.removeEventListener(INCOMING_REQUESTS_UPDATED_EVENT, handleIncomingRequestsUpdated)
        }
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
