import { createContext, useContext, useMemo } from 'react'
import { useMembersList } from '../../auth/services/userService'
import { useFriendIds, useIncomingFriendRequests } from '../services/friendService'

const FriendsContext = createContext({
    friends: [],
    incomingRequests: [],
})

const FriendsProvider = ({ profile, children }) => {

    const friendIds = useFriendIds(profile?.uid)
    const friends = useMembersList(friendIds)
    const incomingRequests = useIncomingFriendRequests(profile?.uid)
    const incomingRequesterIds = useMemo(() => incomingRequests.map((request) => request.fromUserId), [incomingRequests])
    const incomingUsers = useMembersList(incomingRequesterIds)

    const incomingRequestsWithUsers = useMemo(() => {
        return incomingRequests.map((request) => ({
            ...request,
            fromUser: incomingUsers.find((user) => user.uid === request.fromUserId) ?? null,
        }))
    }, [incomingRequests, incomingUsers])

    return (
        <FriendsContext.Provider
            value={{
                friends,
                incomingRequests: incomingRequestsWithUsers,
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
