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
import { FaArrowRightLong, FaUserGroup } from 'react-icons/fa6'
import social0 from '../../../assets/images/illustrations/social0.png'
import PageHeader from '../../../shared/components/ui/PageHeader.jsx'
import FriendsListItem from '../components/FriendsListItem.jsx'
import { FRIENDS_PAGE_SIZE } from '../utils/friendUtils.jsx'
import { useMemo, useState } from 'react'

const Socials = () => {

    const { profile } = useOutletContext()
    const circles = useCircles()
    const { friends } = useFriends()
    const [visibleFriendCount, setVisibleFriendCount] = useState(FRIENDS_PAGE_SIZE)

    const sortedFriends = useMemo(() => {
        return friends.slice().sort((a, b) => (a?.profile?.displayName ?? '').localeCompare(b?.profile?.displayName ?? ''))
    }, [friends])

    const visibleFriends = useMemo(() => sortedFriends.slice(0, visibleFriendCount), [sortedFriends, visibleFriendCount])
    const canLoadMoreFriends = sortedFriends.length > visibleFriends.length

    return (
        <div className='flex flex-col h-full overflow-scroll'>
            <Topbar profile={profile} />

            <div className='w-full h-full flex flex-col gap-8 px-24 pb-8 pt-2 m-auto'>
                <PageHeader text={'Socials'} icon={FaUserGroup} />

                <div className='w-full flex flex-col gap-3'>

                    <Link
                        to='/socials/friends/all'
                        className='self-start flex items-center gap-2 font-semibold text-neutral0 hover:opacity-60 transition cursor-pointer'
                    >
                        <div>Friends <span className='text-neutral1'>{friends.length}</span></div>
                        <FaArrowRightLong />
                    </Link>

                    {friends.length > 0 ? (
                        <div className='w-full overflow-x-auto'>
                            <div className='flex items-start gap-4 min-w-max pb-2'>
                                {visibleFriends.map((friend) => (
                                    <FriendsListItem key={friend.uid} friend={friend} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className='flex items-center'>
                            <p className='text-sm text-neutral1'>You have not added any friends yet.</p>
                        </div>
                    )}



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
                        <h2 className='font-semibold text-neutral0'>
                            Circles <span className='text-neutral1'>{circles.length}</span>
                        </h2>
                        <div className='flex gap-2'>
                            <CreateCircleButton profile={profile} />
                            <JoinCircleButton profile={profile} />
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
                                {circles.sort((a, b) => a.title.localeCompare(b.title)).map((circle) => (
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

const CreateCircleButton = ({ profile }) => {

    const { openModal, closeModal } = useModal()

    const handleClick = () => {
        openModal(<CreateCircleModal profile={profile} closeModal={closeModal} />)
    }

    return (
        <Button onClick={handleClick} type={'secondary'}>
            Create Circle
        </Button>
    )
}

const JoinCircleButton = ({ profile }) => {

    const { openModal, closeModal } = useModal()

    const handleClick = () => {
        openModal(<JoinCircleModal profile={profile} closeModal={closeModal} />)
    }

    return (
        <Button onClick={handleClick} type={'secondary'}>
            Join Circle
        </Button>
    )
}


export default Socials