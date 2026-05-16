import { useMemo, useState } from 'react'
import Button from '../../../shared/components/ui/Button'
import { useFriends } from '../contexts/FriendsContext'
import FriendCard from '../components/FriendCard'
import { FRIENDS_PAGE_SIZE } from '../utils/friendUtils'
import { Link } from 'react-router-dom'

const AllFriendsTab = () => {

    const { friends } = useFriends()
    const [visibleFriendsCount, setVisibleFriendsCount] = useState(FRIENDS_PAGE_SIZE)

    const sortedFriends = useMemo(() => {
        return friends.slice().sort((a, b) => (a?.profile?.displayName ?? '').localeCompare(b?.profile?.displayName ?? ''))
    }, [friends])

    const visibleFriends = sortedFriends.slice(0, visibleFriendsCount)
    const canLoadMoreFriends = sortedFriends.length > visibleFriends.length

    return (
        <div className='flex flex-col gap-4'>

            <h2 className='font-semibold text-neutral0'>
                My Friends <span className='text-neutral1'>{sortedFriends.length}</span>
            </h2>

            {sortedFriends.length > 0 ? (
                <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
                    {visibleFriends.map((friend) => (
                        <Link
                            key={friend.uid}
                            to={`/profile/${encodeURIComponent(friend?.profile?.displayName ?? '')}`}
                        >
                            <FriendCard friend={friend} />
                        </Link>
                    ))}
                </div>
            ) : (
                <div className='flex justify-center items-center py-16'>
                    <p className='text-sm text-neutral1'>You have not added any friends yet.</p>
                </div>
            )}


            {canLoadMoreFriends && (
                <div className='w-full flex justify-center pt-2'>
                    <Button type='secondary' onClick={() => setVisibleFriendsCount((prev) => prev + FRIENDS_PAGE_SIZE)}>
                        Load More
                    </Button>
                </div>
            )}

        </div>
    )
}

export default AllFriendsTab
