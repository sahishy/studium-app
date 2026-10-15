import { useOnboarding } from '../../../features/onboarding/OnboardingContext'
import SidebarCircles from '../../../features/socials/components/SidebarCircles'
import { useCirclePins } from '../../../features/socials/components/useCirclePins'
import { useCircles, useCirclesConfirmed } from '../../../features/socials/contexts/CirclesContext'
import { useMemo, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FaClock, FaArrowRight, FaBookOpen, FaBoxArchive, FaArrowTrendUp, FaChevronDown, FaChild, FaGraduationCap, FaUserGroup, FaHouse, FaUser, FaGear, FaCommentMedical } from 'react-icons/fa6'
import TextTooltip from '../tooltips/TextTooltip.jsx'
import { useModal } from '../../contexts/ModalContext.jsx'
import FeedbackModal from '../../../features/feedback/components/FeedbackModal.jsx'
import { RiSwordFill } from 'react-icons/ri';
import AvatarPicture from '../avatar/AvatarPicture.jsx';
import { useMultiplayer } from '../../../features/multiplayer/contexts/MultiplayerContext.jsx'
import { useFriends } from '../../../features/socials/contexts/FriendsContext.jsx'
import { useUserStats } from '../../../features/profile/contexts/UserStatsContext.jsx'
import { useEconomy } from '../../../features/economy/EconomyContext.jsx'
import { useQuests } from '../../../features/quests/QuestContext.jsx'
import { getCombinedRankedElo } from '../../../features/multiplayer/utils/multiplayerUtils.jsx'
import { useTasks } from '../../../features/agenda/contexts/TasksContext'
import { hasTasksDueOnDate } from '../../../features/agenda/utils/taskViewUtils'
import { dateToIsoKey } from '../../../features/agenda/utils/taskScheduleUtils'
import useToday from '../../hooks/useToday'
import Logo from '../misc/Logo.jsx';

const PLAY_ITEMS = [
    { title: 'Lobby', path: '/play', icon: <FaHouse /> },
    { title: 'Progress', path: '/progress', icon: <FaArrowTrendUp /> },
    { title: 'Locker', path: '/locker', icon: <FaChild /> },
    { title: 'Socials', path: '/socials', icon: <FaUserGroup /> },
]

const STUDY_ITEMS = [
    { title: 'Agenda', path: '/agenda', icon: <FaBookOpen /> },
    { title: 'Courses', path: '/courses', icon: <FaGraduationCap /> },
    { title: 'Resources', path: '/resources', icon: <FaBoxArchive /> },
]

const GROUPS = {
    play: { title: 'Play', items: PLAY_ITEMS, storageKey: 'sidebar:playExpanded' },
    study: { title: 'Study', items: STUDY_ITEMS, storageKey: 'sidebar:studyExpanded' },
}

const DEFAULT_GROUP_ORDER = ['play', 'study']
const GROUP_ORDER_KEY = 'sidebar:groupOrder'

// Keep whatever stored order still makes sense, then append any group the
// stored value never knew about.
const getStoredGroupOrder = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem(GROUP_ORDER_KEY))
        if (!Array.isArray(parsed)) return DEFAULT_GROUP_ORDER
        const known = parsed.filter((id) => DEFAULT_GROUP_ORDER.includes(id))
        return [...new Set([...known, ...DEFAULT_GROUP_ORDER])]
    } catch {
        return DEFAULT_GROUP_ORDER
    }
}

const getStoredGroupState = (key, defaultValue) => {
    try {
        const storedValue = localStorage.getItem(key)
        return storedValue === null ? defaultValue : storedValue === 'true'
    } catch {
        return defaultValue
    }
}

const Sidebar = ({ profile, mobile = false, onNavigate }) => {

    const navigate = useNavigate();
    const circles = useCircles()
    const {pins,toggle:togglePin} = useCirclePins(profile.uid,circles,useCirclesConfirmed())
    const [socialsExpanded,setSocialsExpanded] = useState(() => getStoredGroupState('sidebar:socialsExpanded',true))
    const toggleSocials = () => toggleGroup('sidebar:socialsExpanded',setSocialsExpanded)
    const {sidebarGroup:tutorialGroup} = useOnboarding()

    const location = useLocation()
    const { openModal, closeModalById } = useModal()

    const handleFeedback = () => {
        const modalId = openModal(<FeedbackModal closeModal={() => closeModalById(modalId)} />)
        onNavigate?.()
    }

    const { incomingRequests } = useFriends()
    const { session } = useMultiplayer()
    const { userStats } = useUserStats()
    const { snapshot: economy } = useEconomy()
    const { quests } = useQuests()
    const { user: userTasks, circle: circleTasks } = useTasks()
    const today = useToday()
    const navigationDisabled = (session?.status === 'in_room' && Boolean(session?.currentRoomId))
        || location.pathname.startsWith('/play/tutorial/')

    // Paths that should show a dot in the sidebar, each owned by whatever
    // actually needs the student's attention.
    const notifications = useMemo(() => ({
        '/socials': incomingRequests.length > 0,
        '/progress': (economy?.claimable?.length ?? 0) > 0 || quests.some(quest => quest.completed),
    }), [economy?.claimable?.length, incomingRequests.length, quests])

    // A route can supply any conditionally visible icon and accessible label.
    const indicators = {
        '/agenda': hasTasksDueOnDate([...userTasks, ...circleTasks], dateToIsoKey(today))
            ? { icon: <FaClock />, label: 'Tasks due today' }
            : null,
    }

    const displayName = profile?.profile?.displayName || ''
    const combinedRankedElo = getCombinedRankedElo(userStats)
    const [playExpanded, setPlayExpanded] = useState(() => getStoredGroupState('sidebar:playExpanded', true))
    const [studyExpanded, setStudyExpanded] = useState(() => getStoredGroupState('sidebar:studyExpanded', false))

    const [groupOrder, setGroupOrder] = useState(getStoredGroupOrder)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 },
        })
    )

    const handleGroupDragEnd = ({ active, over }) => {
        if (!over || active.id === over.id) return
        setGroupOrder((currentOrder) => {
            const from = currentOrder.indexOf(active.id)
            const to = currentOrder.indexOf(over.id)
            if (from === -1 || to === -1) return currentOrder
            const nextOrder = arrayMove(currentOrder, from, to)
            try {
                localStorage.setItem(GROUP_ORDER_KEY, JSON.stringify(nextOrder))
            } catch {
                // Keep the in-memory preference when storage is unavailable.
            }
            return nextOrder
        })
    }

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
        <aside className={`bg-neutral5 p-4 ${mobile ? 'flex h-full' : 'hidden lg:flex h-dvh'} min-h-0 overflow-y-auto overscroll-y-contain flex-col justify-between gap-6 shrink-0 w-56 border-r border-neutral4`}>

            <div className='flex shrink-0 flex-col gap-6'>

                <Logo className={'p-2'} large />

                <div className='py-6 flex flex-col gap-3 items-center'>
                    <button onClick={() => { navigate(`/profile/${encodeURIComponent(profile?.profile?.displayName ?? '')}`); onNavigate?.() }}>
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
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
                        <SortableContext items={groupOrder} strategy={verticalListSortingStrategy}>
                            {groupOrder.map((groupId) => {
                                const group = GROUPS[groupId]
                                const expanded = tutorialGroup === groupId || (groupId === 'play' ? playExpanded : studyExpanded)
                                const setter = groupId === 'play' ? setPlayExpanded : setStudyExpanded
                                return (
                                    <SidebarGroup
                                        key={groupId}
                                        id={groupId}
                                        title={group.title}
                                        expanded={expanded}
                                        onToggle={() => toggleGroup(group.storageKey, setter)}
                                        items={group.items}
                                        location={location}
                                        disabled={navigationDisabled}
                                        notifications={notifications}
                                        indicators={indicators}
                                        socialsExpanded={socialsExpanded}
                                        onSocialsClick={toggleSocials}
                                        hasPinnedCircles={pins.length>0}
                                        circleLinks={<SidebarCircles expanded={expanded && socialsExpanded} pins={pins} toggle={togglePin} onNavigate={onNavigate} disabled={navigationDisabled} />}
                                        onNavigate={onNavigate}
                                    />
                                )
                            })}
                        </SortableContext>
                    </DndContext>
                </div>


            </div>

            <div className='flex shrink-0 flex-col gap-4'>
                <div className={`flex justify-center gap-1 mb-6 text-sm ${navigationDisabled ? 'opacity-40' : ''}`}>
                    <TextTooltip text='Profile' placement='top'>
                        <Link
                            to={`/profile/${encodeURIComponent(profile?.profile?.displayName ?? '')}`}
                            onClick={navigationDisabled ? (event) => event.preventDefault() : onNavigate}
                            aria-label='Profile'
                            aria-disabled={navigationDisabled}
                            className={`size-9 flex items-center justify-center rounded-full transition text-neutral2 ${navigationDisabled ? 'cursor-not-allowed' : 'hover:text-neutral0'}`}
                        >
                            <FaUser />
                        </Link>
                    </TextTooltip>
                    <TextTooltip text='Settings' placement='top'>
                        <Link
                            to='/settings'
                            onClick={navigationDisabled ? (event) => event.preventDefault() : onNavigate}
                            aria-label='Settings'
                            aria-disabled={navigationDisabled}
                            className={`size-9 flex items-center justify-center rounded-full transition text-neutral2 ${navigationDisabled ? 'cursor-not-allowed' : 'hover:text-neutral0'}`}
                        >
                            <FaGear />
                        </Link>
                    </TextTooltip>
                    <TextTooltip text='Submit Feedback' placement='top'>
                        <button
                            type='button'
                            aria-label='Submit Feedback'
                            disabled={navigationDisabled}
                            onClick={handleFeedback}
                            className='size-9 flex items-center justify-center rounded-full text-neutral2 transition hover:text-neutral0 cursor-pointer disabled:cursor-not-allowed disabled:hover:text-neutral2'
                        >
                            <FaCommentMedical />
                        </button>
                    </TextTooltip>
                </div>
            </div>


        </aside>
    )
}

const SidebarGroup = ({ id, title, expanded, onToggle, items, location, disabled, notifications, indicators, onNavigate, socialsExpanded, onSocialsClick, circleLinks, hasPinnedCircles }) => {
    const onSocialsScreen=location.pathname.startsWith('/socials') && !location.pathname.startsWith('/socials/circle/')

    // The header doubles as the drag handle, so a short press still toggles
    // the group while a real drag reorders it.
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`flex flex-col ${isDragging ? 'opacity-80 z-20' : ''}`}
        >
            <button
                type='button'
                onClick={onToggle}
                aria-expanded={expanded}
                disabled={disabled}
                {...attributes}
                {...listeners}
                className={`flex gap-3 items-center justify-between px-3 py-2 text-xs uppercase font-semibold text-neutral1 rounded-xl 
                    transition disabled:cursor-not-allowed disabled:opacity-40
                    ${isDragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
            >
                <span>{title}</span>
                <hr className='w-full border-1 border-neutral3'/>
                <FaChevronDown className={`shrink-0 text-xs text-neutral2 transition-transform ${expanded ? '' : '-rotate-90'}`} />
            </button>

            {items.filter(item=>expanded || (item.path==='/socials' && hasPinnedCircles)).map((item) => (
                <div key={item.path}><SidebarNavLink
                    key={item.path}
                    item={item}
                    isActive={item.path === '/socials' ? onSocialsScreen : location.pathname.startsWith(item.path)}
                    disabled={disabled}
                    showNotification={Boolean(notifications?.[item.path])}
                    indicator={indicators?.[item.path]}
                    onNavigate={() => { if(item.path === '/socials' && onSocialsScreen) onSocialsClick?.(); onNavigate?.() }}
                    disclosure={item.path === '/socials' && onSocialsScreen ? socialsExpanded : undefined}
                />{item.path === '/socials' && circleLinks}</div>
            ))}
        </div>
    )
}

const SidebarNavLink = ({ item, isActive, disabled = false, showNotification = false, indicator, onNavigate, disclosure }) => {

    if (disabled) {
        return (
            <div
                className='flex items-center px-3 py-2 gap-2 rounded-xl text-neutral1 cursor-not-allowed opacity-40'
            >
                <div className='text-sm'>{item.icon}</div>
                <div className='text-sm text-nowrap flex items-center gap-2'>
                    {item.title}
                </div>
                {indicator && <span role='img' aria-label={indicator.label} className='ml-auto flex items-center text-xs text-neutral2'>{indicator.icon}</span>}
            </div>
        )
    }

    return (
        <NavLink
            key={item.title}
            data-onboarding={`nav:${item.path}`}
            to={item.path}
            onClick={onNavigate}
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
            {disclosure !== undefined && <FaChevronDown className={`ml-auto text-xs ${disclosure ? '' : '-rotate-90'}`} />}
            {indicator && <span role='img' aria-label={indicator.label} className={`ml-auto flex items-center text-xs transition-colors group-focus-visible:text-neutral1 ${isActive ? 'text-neutral1' : 'text-neutral2'}`}>{indicator.icon}</span>}
        </NavLink>
    )
}

export default Sidebar
