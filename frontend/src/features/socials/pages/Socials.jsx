import { Link, useOutletContext } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar.jsx'
import CircleCard from '../components/CircleCard.jsx'
import CreateCircleModal from '../components/modals/CreateCircleModal.jsx'
import { useModal } from '../../../shared/contexts/ModalContext.jsx'
import JoinCircleModal from '../components/modals/JoinCircleModal.jsx'
import { useCircles } from '../contexts/CirclesContext.jsx'
import { useFriends } from '../contexts/FriendsContext.jsx'
import Button from '../../../shared/components/ui/Button.jsx'
import BottomFade from '../../../shared/components/ui/BottomFade.jsx'
import { FaArrowRightLong, FaPlus, FaUserGroup } from 'react-icons/fa6'
import social0 from '../../../assets/images/illustrations/social0.png'
import PageHeader from '../../../shared/components/ui/PageHeader.jsx'
import FriendsListItem from '../components/FriendsListItem.jsx'
import { FRIENDS_PAGE_SIZE } from '../utils/friendUtils.jsx'
import { useMemo, useState } from 'react'
import LoadingState from '../../../shared/components/ui/LoadingState.jsx'
import AddFriendModal from '../components/modals/AddFriendModal.jsx'
import { CIRCLE_MAX_COUNT } from '../utils/circleUtils.jsx'

const Socials = () => {

    const { profile } = useOutletContext()
    const circles = useCircles()
    
    const { friends, incomingRequests, friendsLoading, incomingRequestsLoading } = useFriends()
    const [visibleFriendCount, setVisibleFriendCount] = useState(FRIENDS_PAGE_SIZE)

    const { openModal, closeModal } = useModal()
    const hasReachedCircleLimit = circles.length >= CIRCLE_MAX_COUNT

    const sortedFriends = useMemo(() => {
        return friends.slice().sort((a, b) => (a?.profile?.displayName ?? '').localeCompare(b?.profile?.displayName ?? ''))
    }, [friends])

    const visibleFriends = useMemo(() => sortedFriends.slice(0, visibleFriendCount), [sortedFriends, visibleFriendCount])
    const canLoadMoreFriends = sortedFriends.length > visibleFriends.length
    const isLoading = friendsLoading || incomingRequestsLoading

    const handleAddFriend = () => {
        openModal(<AddFriendModal profile={profile} closeModal={closeModal} />)
    }

    if (isLoading) {
        return <LoadingState fullPage />
    }

    return (
        <div className='flex flex-col h-full overflow-y-auto overflow-x-hidden'>
            <Topbar profile={profile} />

            <div className='w-full h-full flex flex-col gap-8 px-24 pb-8 pt-2 m-auto'>
                <PageHeader text={'Socials'} icon={FaUserGroup} />

                <div className='w-full flex flex-col gap-3'>

                    <div className='flex items-center justify-between'>
                        <h2 className='text-lg font-semibold text-neutral0'>Friends</h2>
                        <Link
                            to='/socials/friends/all'
                            className='px-4 py-2.5 rounded-full border border-neutral4 text-neutral0 font-semibold text-sm 
                                hover:bg-neutral5 transition-all flex items-center gap-2'
                        >
                            View All
                            <div className='relative'>
                                <FaArrowRightLong />
                                {incomingRequests.length > 0 && (
                                    <div className={`absolute -top-0.5 -right-2 w-2.5 h-2.5 rounded-full bg-sky-500 border-2 border-neutral6 transition`} />
                                )}
                            </div>
                        </Link>
                    </div>

                    <div className='relative w-full'>
                        <div className='w-full overflow-x-auto no-scrollbar'>
                            <div className='flex items-start gap-4 min-w-max pb-2'>
                                <button 
                                    onClick={handleAddFriend}
                                    className='flex flex-col gap-2 cursor-pointer group'
                                >
                                    <div className='w-24 h-24 flex items-center justify-center rounded-full bg-neutral5 
                                            group-hover:bg-neutral4 transition'
                                    >
                                        <FaPlus className='text-neutral1 text-2xl' />
                                    </div>
                                    <p className='text-xs text-neutral1'>Add Friend</p>
                                </button>
                                {visibleFriends.map((friend) => (
                                    <FriendsListItem key={friend.uid} friend={friend} />
                                ))}

                            </div>
                        </div>
                        <div className='absolute top-0 right-0 w-8 h-full bg-linear-to-l from-neutral6 to-transparent' />
                        {/* <div className='absolute top-0 left-0 w-8 h-full bg-linear-to-r from-neutral6 to-transparent' /> */}
                    </div>

                    {canLoadMoreFriends && (
                        <div className='w-full flex justify-center pt-1'>
                            <Button type='secondary' onClick={() => setVisibleFriendCount((prev) => prev + FRIENDS_PAGE_SIZE)}>
                                Load More
                            </Button>
                        </div>
                    )}

                </div>

                <div className='w-full flex flex-col gap-2 pb-16'>

                    <div className='flex items-center justify-between'>
                        <h2 className='text-lg font-semibold text-neutral0'>Circles</h2>
                        <div className='flex gap-2'>
                            <CreateCircleButton profile={profile} disabled={hasReachedCircleLimit} />
                            <JoinCircleButton profile={profile} disabled={hasReachedCircleLimit} />
                        </div>
                    </div>

                    <div className='relative w-full flex flex-col gap-4'>
                        {circles.length === 0 ? (
                            <div className='w-full flex flex-col items-center justify-center py-16 gap-1'>
                                <img src={social0} alt='Friends studying' className='object-contain w-96 mb-3' />
                                <h1 className='text-3xl font-bold'>No circles</h1>
                                <p className='text-sm text-neutral1'>You haven't joined any study circles yet. Join or create one!</p>
                            </div>
                        ) : (
                            <div className='w-full grid grid-cols-2 auto-rows-auto gap-4'>
                                {circles.sort((a, b) => a.profile.title.localeCompare(b.profile.title)).map((circle) => (
                                    <Link
                                        key={circle.uid}
                                        to={`/socials/circle/${circle.uid}`}
                                    >
                                        <CircleCard circle={circle} />
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                </div>

            </div>
            <BottomFade />
        </div>
    )

}

const CreateCircleButton = ({ profile, disabled = false }) => {

    const { openModal, closeModal } = useModal()

    const handleClick = () => {
        openModal(<CreateCircleModal profile={profile} closeModal={closeModal} />)
    }

    return (
        <Button onClick={handleClick} type={'secondary'} disabled={disabled}>
            Create Circle
        </Button>
    )
}

const JoinCircleButton = ({ profile, disabled = false }) => {

    const { openModal, closeModal } = useModal()

    const handleClick = () => {
        openModal(<JoinCircleModal profile={profile} closeModal={closeModal} />)
    }

    return (
        <Button onClick={handleClick} type={'secondary'} disabled={disabled}>
            Join Circle
        </Button>
    )
}


export default Socials