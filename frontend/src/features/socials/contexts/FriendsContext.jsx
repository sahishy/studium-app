import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { useMembersList } from '../../auth/services/userService'
import { useToast } from '../../../shared/contexts/ToastContext'
import FriendRequestToast from '../components/toasts/FriendRequestToast'
import { acceptFriendRequest, ignoreFriendRequest, useFriendIds, useIncomingFriendRequests } from '../services/friendService'

const FriendsContext = createContext({
    friends: [],
    incomingRequests: [],
    friendsLoading: true,
    incomingRequestsLoading: true,
})

const EMPTY_REQUESTS = []

const FriendsProvider = ({ profile, children }) => {

    const { showToast, hideToast } = useToast()
    const friendIds = useFriendIds(profile?.uid)
    const friends = useMembersList(friendIds)
    const incomingRequests = useIncomingFriendRequests(profile?.uid)
    const friendsLoading = profile?.uid != null && friendIds.length > 0 && friends.length !== friendIds.length
    const incomingRequestsLoading = profile?.uid != null && incomingRequests == null
    const hasIncomingLoaded = incomingRequests != null
    const safeIncomingRequests = incomingRequests ?? EMPTY_REQUESTS
    const incomingRequesterIds = useMemo(() => safeIncomingRequests.map((request) => request.fromUserId), [safeIncomingRequests])
    const incomingUsers = useMembersList(incomingRequesterIds)
    const previousIncomingIdsRef = useRef(new Set())
    const pendingIncomingIdsRef = useRef(new Set())
    const requestToastIdsRef = useRef(new Map())
    const hasInitializedIncomingRef = useRef(false)

    const incomingRequestsWithUsers = useMemo(() => {
        return safeIncomingRequests.map((request) => ({
            ...request,
            fromUser: incomingUsers.find((user) => user.uid === request.fromUserId) ?? null,
        }))
    }, [safeIncomingRequests, incomingUsers])

    useEffect(() => {
        if(!profile?.uid) {
            hasInitializedIncomingRef.current = false
            previousIncomingIdsRef.current = new Set()
            pendingIncomingIdsRef.current = new Set()
            requestToastIdsRef.current = new Map()
            return
        }

        if(!hasIncomingLoaded) {
            return
        }

        const incomingRequestIds = safeIncomingRequests
            .map((request) => request?.uid)
            .filter(Boolean)
        const incomingRequestIdSet = new Set(incomingRequestIds)

        const removedRequestIds = Array.from(previousIncomingIdsRef.current).filter((requestId) => {
            return !incomingRequestIdSet.has(requestId)
        })

        removedRequestIds.forEach((requestId) => {
            const toastId = requestToastIdsRef.current.get(requestId)
            if(toastId) {
                hideToast(toastId, { force: true })
                requestToastIdsRef.current.delete(requestId)
            }

            pendingIncomingIdsRef.current.delete(requestId)
        })

        if(!hasInitializedIncomingRef.current) {
            previousIncomingIdsRef.current = incomingRequestIdSet
            hasInitializedIncomingRef.current = true
            return
        }

        const newIncomingRequests = safeIncomingRequests.filter((request) => {
            return request?.uid && !previousIncomingIdsRef.current.has(request.uid)
        })

        newIncomingRequests.forEach((request) => {
            if(request?.uid) {
                pendingIncomingIdsRef.current.add(request.uid)
            }
        })

        const pendingIncomingRequests = safeIncomingRequests.filter((request) => {
            return request?.uid && pendingIncomingIdsRef.current.has(request.uid)
        })

        pendingIncomingRequests.forEach((request) => {
            const requester = incomingUsers.find((user) => user.uid === request.fromUserId)

            if(!requester) {
                return
            }

            const toastId = showToast({
                component: FriendRequestToast,
                canHide: false,
                duration: 10000,
                props: {
                    requester,
                    onIgnore: async () => {
                        await ignoreFriendRequest(request.uid)
                    },
                    onAccept: async () => {
                        await acceptFriendRequest({
                            requestId: request.uid,
                            currentUserId: profile.uid,
                            fromUserId: request.fromUserId,
                        })
                    },
                },
            })

            if(toastId) {
                requestToastIdsRef.current.set(request.uid, toastId)
            }

            pendingIncomingIdsRef.current.delete(request.uid)
        })

        previousIncomingIdsRef.current = incomingRequestIdSet
    }, [hasIncomingLoaded, safeIncomingRequests, incomingUsers, profile?.uid, showToast, hideToast])

    return (
        <FriendsContext.Provider
            value={{
                friends,
                incomingRequests: incomingRequestsWithUsers,
                friendsLoading,
                incomingRequestsLoading,
            }}
        >
            {children}
        </FriendsContext.Provider>
    )
}

const useFriends = () => useContext(FriendsContext)

export {
    FriendsProvider,
    useFriends,
}
