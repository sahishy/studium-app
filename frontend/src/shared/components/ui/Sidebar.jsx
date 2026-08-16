import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { FaArrowRight, FaBookOpen, FaBoxArchive, FaChild, FaChevronDown, FaGraduationCap, FaTrophy, FaUserGroup, FaHouse } from 'react-icons/fa6'
import { RiSwordFill } from 'react-icons/ri';
import AvatarPicture from '../avatar/AvatarPicture.jsx';
import { useMultiplayer } from '../../../features/multiplayer/contexts/MultiplayerContext.jsx'
import { useFriends } from '../../../features/socials/contexts/FriendsContext.jsx'
import { useUserStats } from '../../../features/profile/contexts/UserStatsContext.jsx'
import { getCombinedRankedElo } from '../../../features/multiplayer/utils/multiplayerUtils.jsx'
import Logo from '../misc/Logo.jsx';

const PLAY_ITEMS = [
    { title: 'Lobby', path: '/play', icon: <FaHouse /> },
    { title: 'Leaderboards', path: '/leaderboards', icon: <FaTrophy /> },
    { title: 'Socials', path: '/socials', icon: <FaUserGroup /> },
    { title: 'Avatar', path: '/avatar', icon: <FaChild /> },
]

const STUDY_ITEMS = [
    { title: 'Agenda', path: '/agenda', icon: <FaBookOpen /> },
    { title: 'Courses', path: '/courses', icon: <FaGraduationCap /> },
    { title: 'Resources', path: '/resources', icon: <FaBoxArchive /> },
]

const getStoredGroupState = (key, defaultValue) => {
    try {
        const storedValue = localStorage.getItem(key)
        return storedValue === null ? defaultValue : storedValue === 'true'
    } catch {
        return defaultValue
    }
}

const Sidebar = ({ profile }) => {

    const navigate = useNavigate();
    const location = useLocation()

    const { incomingRequests } = useFriends()
    const { session } = useMultiplayer()
    const { userStats } = useUserStats()
    const inRoom = session?.status === 'in_room' && Boolean(session?.currentRoomId)

    const displayName = profile?.profile?.displayName || ''
    const combinedRankedElo = getCombinedRankedElo(userStats)
    const [playExpanded, setPlayExpanded] = useState(() => getStoredGroupState('sidebar:playExpanded', true))
    const [studyExpanded, setStudyExpanded] = useState(() => getStoredGroupState('sidebar:studyExpanded', false))

    const toggleGroup = (key, setter) => {
        setter((currentValue) => {
            const nextValue = !currentValue
            try {
                localStorage.setItem(key, String(nextValue))
            } catch {
                // Keep the in-memory preference when storage is unavailable.
            }
            return nextValue
        })
    }

    return (
        <aside className={`bg-neutral5 p-4 flex flex-col justify-between shrink-0 w-56 border-r border-neutral4`}>

            <div className='flex flex-col gap-6'>

                <Logo className={'p-2'} large />

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

                    <div className='flex flex-col items-center gap-1'>
                        <h1 className='font-semibold'>{displayName}</h1>
                        <p className='text-xs font-semibold text-neutral1'>
                            {combinedRankedElo} <span className='text-[0.625rem] font-medium'>SAT</span>
                        </p>
                    </div>
                </div>

                <div className='flex flex-col gap-4'>
                    <SidebarGroup
                        title='Play'
                        expanded={playExpanded}
                        onToggle={() => toggleGroup('sidebar:playExpanded', setPlayExpanded)}
                        items={PLAY_ITEMS}
                        location={location}
                        disabled={inRoom}
                        incomingRequests={incomingRequests}
                    />
                    <SidebarGroup
                        title='Study'
                        expanded={studyExpanded}
                        onToggle={() => toggleGroup('sidebar:studyExpanded', setStudyExpanded)}
                        items={STUDY_ITEMS}
                        location={location}
                        disabled={inRoom}
                        incomingRequests={incomingRequests}
                    />
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

                </div>
            </div>


        </aside>
    )
}

const SidebarGroup = ({ title, expanded, onToggle, items, location, disabled, incomingRequests }) => {
    return (
        <div className='flex flex-col'>
            <button
                type='button'
                onClick={onToggle}
                aria-expanded={expanded}
                disabled={disabled}
                className={`flex gap-3 items-center justify-between px-3 py-2 text-xs uppercase font-semibold text-neutral1 rounded-xl 
                    transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40`}
            >
                <span>{title}</span>
                <hr className='w-full border-1 border-neutral3'/>
                <FaChevronDown className={`shrink-0 text-xs text-neutral2 transition-transform ${expanded ? '' : '-rotate-90'}`} />
            </button>

            {expanded && items.map((item) => (
                <SidebarNavLink
                    key={item.path}
                    item={item}
                    isActive={location.pathname.startsWith(item.path)}
                    disabled={disabled}
                    showNotification={item.path === '/socials' && incomingRequests.length > 0}
                />
            ))}
        </div>
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
