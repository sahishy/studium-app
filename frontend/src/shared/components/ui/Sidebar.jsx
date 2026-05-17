import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { FaArrowRight, FaChild, FaGraduationCap, FaUserGroup, FaBookOpen, FaBoxArchive, FaCircle, FaArrowLeft } from 'react-icons/fa6';
import { RiSwordFill } from 'react-icons/ri';
import AvatarPicture from '../avatar/AvatarPicture.jsx';
import { useMultiplayer } from '../../../features/multiplayer/contexts/MultiplayerContext.jsx'
import { leaveRoom } from '../../../features/multiplayer/services/roomService.jsx'
import { useFriends } from '../../../features/socials/contexts/FriendsContext.jsx'
import Button from './Button.jsx';
import Logo from '../misc/Logo.jsx';

const navItems = [
    { title: 'Agenda', path: '/agenda', icon: <FaBookOpen /> },
    { title: 'Courses', path: '/courses', icon: <FaGraduationCap /> },
    { title: 'Socials', path: '/socials', icon: <FaUserGroup /> },
    { title: 'Resources', path: '/resources', icon: <FaBoxArchive /> },
    { title: 'Avatar', path: '/avatar', icon: <FaChild /> },
]

const Sidebar = ({ profile }) => {

    const navigate = useNavigate();
    const location = useLocation()

    const { incomingRequests } = useFriends()
    const { session } = useMultiplayer()
    const inRoom = session?.status === 'in_room' && Boolean(session?.currentRoomId)

    const displayName = profile?.profile?.displayName || ''

    return (
        <aside className={`bg-neutral5 p-4 flex flex-col justify-between shrink-0 w-64 border-r border-neutral4`}>

            <div className='flex flex-col gap-6'>

                <Logo className={'p-2'} large/>

                <div className='py-6 flex flex-col gap-3 items-center'>
                    <button onClick={() => navigate(`/profile/${encodeURIComponent(profile?.profile?.displayName ?? '')}`)}>
                        <AvatarPicture profile={profile} className='relative w-16 h-16 group/avatar cursor-pointer'>
                            <div className={`absolute -bottom-1 -right-1 bg-neutral3/60 backdrop-blur-xs rounded-full p-2
                                opacity-0 group-hover/avatar:opacity-100 transition
                            `}>
                                <FaArrowRight className='text-sm group-hover/avatar:-rotate-45 transition' />
                            </div>
                        </AvatarPicture>
                    </button>

                    <div className='flex flex-col items-center'>
                        <h1 className='font-semibold'>{profile.firstName} {profile.lastName}</h1>
                        <p className='text-xs text-neutral1'>@{displayName}</p>
                    </div>
                </div>

                <div className='flex flex-col'>
                    <MultiplayerButton profile={profile} inRoom={inRoom} />
                    {navItems.map((item, index) => (
                        <SidebarNavLink
                            key={index}
                            item={item}
                            isActive={location.pathname.startsWith(item.path)}
                            disabled={inRoom}
                            showNotification={item.path === '/socials' && incomingRequests.length > 0}
                        />
                    ))}
                </div>


            </div>

            <div className='flex flex-col gap-4'>
                <div className={`flex justify-center gap-6 mb-6 text-xs ${inRoom && 'opacity-40'}`}>
                    <Link
                        to={`/profile/${encodeURIComponent(profile?.profile?.displayName ?? '')}`}
                        onClick={inRoom ? (event) => event.preventDefault() : undefined}
                        className={`transition text-neutral1 ${inRoom ? 'cursor-not-allowed' : 'hover:text-neutral0'}`}
                    >
                        Profile
                    </Link>
                    <Link
                        to='/settings'
                        onClick={inRoom ? (event) => event.preventDefault() : undefined}
                        className={`transition text-neutral1 ${inRoom ? 'cursor-not-allowed' : 'hover:text-neutral0'}`}
                    >
                        Settings
                    </Link>
                    <Link
                        to='/settings'
                        onClick={inRoom ? (event) => event.preventDefault() : undefined}
                        className={`transition text-neutral1 ${inRoom ? 'cursor-not-allowed' : 'hover:text-neutral0'}`}
                    >
                        FAQ
                    </Link>
                </div>
            </div>


        </aside>
    )
}

const MultiplayerButton = ({ profile, inRoom }) => {

    const navigate = useNavigate();
    const { session } = useMultiplayer()

    const handleClick = async () => {
        if (!inRoom) {
            navigate('/ranked')
            return
        }

        const roomId = session?.currentRoomId
        const userId = profile?.uid

        if (!roomId || !userId) {
            return
        }

        const leaverName = profile?.profile?.displayName || `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() || 'Player'

        await leaveRoom({ roomId, userId, leaverName })
        navigate('/ranked')
    }

    return (
        <Button
            onClick={handleClick}
            type={inRoom ? 'negative' : 'primary'}
            className='mb-3'
        >
            {inRoom ? <FaArrowLeft /> : <RiSwordFill />}
            {inRoom ? 'Leave Game' : 'SAT Ranked'}
        </Button>
    )
}

const SidebarNavLink = ({ item, isActive, disabled = false, showNotification = false }) => {

    if (disabled) {
        return (
            <div
                className='flex items-center px-3 py-2 gap-2 rounded-xl text-neutral1 cursor-not-allowed opacity-40'
            >
                <div className='text-sm'>{item.icon}</div>
                <div className='text-sm text-nowrap flex items-center gap-2'>
                    {item.title}
                </div>
            </div>
        )
    }

    return (
        <NavLink
            key={item.title}
            to={item.path}
            end
            className={
                `flex items-center px-3 py-2 gap-2 rounded-xl transition-all group
                ${(isActive) ? 'text-neutral0 bg-neutral3' : 'text-neutral1 hover:bg-neutral4'}`
            }
        >
            <div className='relative text-sm'>
                {item.icon}
                {showNotification && (
                    <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2 transition
                        ${isActive ? 'bg-sky-500 border-neutral3' : 'bg-sky-300 border-neutral5 group-hover:border-neutral4'}`} />
                )}
            </div>
            <div className='text-sm text-nowrap'>
                {item.title}
            </div>
        </NavLink>
    )
}

export default Sidebar