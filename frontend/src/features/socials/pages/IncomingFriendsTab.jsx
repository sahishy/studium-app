import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Button from '../../../shared/components/ui/Button'
import { useFriends } from '../contexts/FriendsContext'
import { acceptFriendRequest, ignoreFriendRequest } from '../services/friendService'
import FriendRequestCard from '../components/FriendRequestCard'
import { INCOMING_REQUESTS_PAGE_SIZE } from '../utils/friendUtils'

const IncomingFriendsTab = () => {

    const { profile } = useOutletContext()
    const { incomingRequests } = useFriends()
    const [visibleIncomingCount, setVisibleIncomingCount] = useState(INCOMING_REQUESTS_PAGE_SIZE)

    const sortedIncoming = useMemo(() => {
        return incomingRequests
            .slice()
            .sort((a, b) => (b?.createdAt?.seconds ?? 0) - (a?.createdAt?.seconds ?? 0))
    }, [incomingRequests])

    const visibleIncoming = sortedIncoming.slice(0, visibleIncomingCount)
    const canLoadMoreIncoming = sortedIncoming.length > visibleIncoming.length

    const handleAccept = async (request) => {
        await acceptFriendRequest({
            requestId: request.uid,
            currentUserId: profile.uid,
            fromUserId: request.fromUserId,
        })
    }

    const handleIgnore = async (request) => {
        await ignoreFriendRequest(request.uid)
    }

    return (
        <div className='flex flex-col gap-4'>

            <h2 className='font-semibold text-neutral0'>
                Incoming Requests <span className='text-neutral1'>{incomingRequests.length}</span>
            </h2>

            {incomingRequests.length > 0 ? (
                <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
                    {visibleIncoming.map((request) => (
                        <FriendRequestCard
                            key={request.uid}
                            request={request}
                            onAccept={handleAccept}
                            onIgnore={handleIgnore}
                        />
                    ))}
                </div>
            ) : (
                <div className='flex justify-center items-center py-16'>
                    <p className='text-sm text-neutral1'>You have no incoming friend requests.</p>
                </div>
            )}


            {canLoadMoreIncoming && (
                <div className='w-full flex justify-center pt-2'>
                    <Button
                        type='secondary'
                        onClick={() => setVisibleIncomingCount((prev) => prev + INCOMING_REQUESTS_PAGE_SIZE)}
                    >
                        Load More
                    </Button>
                </div>
            )}
        </div>
    )

}

export default IncomingFriendsTab
