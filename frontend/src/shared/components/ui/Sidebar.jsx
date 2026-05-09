import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import logo from '../../../assets/images/logo_lg.png'
import logoWhite from '../../../assets/images/logo_lg_white.png'
import { FaArrowRight, FaChild, FaGraduationCap, FaUserGroup, FaBookOpen, FaBoxArchive, FaCircle, FaArrowLeft } from 'react-icons/fa6';
import { RiSwordFill } from 'react-icons/ri';
import AvatarPicture from '../avatar/AvatarPicture.jsx';
import { useMultiplayer } from '../../../features/multiplayer/contexts/MultiplayerContext.jsx'
import { leaveRoom } from '../../../features/multiplayer/services/roomService.jsx'
import Button from './Button.jsx';

const navItems = [
    { title: 'Agenda', path: '/agenda', icon: <FaBookOpen /> },
    { title: 'Courses', path: '/courses', icon: <FaGraduationCap /> },
    { title: 'Circles', path: '/circles', icon: <FaUserGroup /> },
    { title: 'Resources', path: '/resources', icon: <FaBoxArchive /> },
    { title: 'Avatar', path: '/avatar', icon: <FaChild /> },
]

const Sidebar = ({ profile }) => {

    const navigate = useNavigate();
    const location = useLocation()
    const { session } = useMultiplayer()
    const inRoom = session?.status === 'in_room' && Boolean(session?.currentRoomId)

    const displayName = profile?.profile?.displayName || ''

    return (
        <aside className={`bg-neutral5 p-4 flex flex-col justify-between shrink-0 w-64 border-r border-neutral4`}>

            <div className='flex flex-col gap-6'>

                <img src={logo} alt="Logo" className="w-36 h-12 p-2 object-contain dark:hidden" />
                <img src={logoWhite} alt="Logo" className="w-36 h-12 p-2 object-contain hidden dark:flex" />

                <div className='py-6 flex flex-col gap-3 items-center'>
                    <button onClick={() => navigate(`/profile/${profile.uid}`)}>
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
                        />
                    ))}
                </div>


            </div>

            <div className='flex flex-col gap-4'>
                <div className={`flex justify-center gap-6 mb-6 text-xs ${inRoom && 'opacity-40'}`}>
                    <Link
                        to={`/profile/${profile?.uid}`}
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

const SidebarNavLink = ({ item, isActive, disabled = false }) => {

    if (disabled) {
        return (
            <div
                className='flex items-center px-3 py-2 gap-2 rounded-xl text-neutral1 cursor-not-allowed opacity-40'
            >
                <div className='text-sm'>{item.icon}</div>
                <div className='text-sm text-nowrap'>{item.title}</div>
            </div>
        )
    }

    return (
        <NavLink
            key={item.title}
            to={item.path}
            end
            className={
                `flex items-center px-3 py-2 gap-2 rounded-xl transition-all  ${(isActive) ? 'text-neutral0 bg-neutral3' : 'text-neutral1 hover:bg-neutral4'}`
            }
        >
            <div className='text-sm'>{item.icon}</div>
            <div className='text-sm text-nowrap'>{item.title}</div>
        </NavLink>
    )
}

export default Sidebar