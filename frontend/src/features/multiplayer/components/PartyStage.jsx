import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FaCrown, FaPlus, FaRightToBracket } from 'react-icons/fa6'
import AvatarModel from '../../../shared/components/avatar/AvatarModel'
import Podium from '../../../shared/components/avatar/Podium'
import { getRankInfoFromElo } from '../../profile/utils/statsUtils'

// Temporary visual-preview control. Change this to 1–7 to add that many
// stage-only players; it has no effect on the actual party or matchmaking.
const PARTY_STAGE_PREVIEW_PLAYER_COUNT = 0

const PREVIEW_PLAYER_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery']
const PREVIEW_AVATAR_COLORS = ['#60a5fa', '#f87171', '#22c55e', '#fcd34d']

const createPreviewMembers = (modeId) => Array.from(
    { length: Math.min(7, Math.max(0, PARTY_STAGE_PREVIEW_PLAYER_COUNT)) },
    (_, index) => ({
        userId: `party-stage-preview-${index + 1}`,
        displayName: PREVIEW_PLAYER_NAMES[index],
        avatar: {
            color: PREVIEW_AVATAR_COLORS[index % PREVIEW_AVATAR_COLORS.length],
            face: index % 3,
        },
        eloByMode: { [modeId]: 900 + ((index + 1) * 125) },
        ready: index % 2 === 0,
    }),
)

const PlayerLabel = ({ member, party, mode, compact = false }) => {
    const elo = Number(member.eloByMode?.[mode?.id]) || 0
    const rank = getRankInfoFromElo(elo)

    return (
        <div className={`absolute ${compact ? '-top-18 min-w-32 px-3 py-2' : '-top-40 min-w-44 px-4 py-3'} z-30 max-w-[92%]`}>
            <div className='flex items-center justify-center gap-2 min-w-0'>
                {party?.id && member.userId === party.leaderUserId ? <FaCrown className='shrink-0 text-amber-400 text-xs' /> : null}
                <p className={`${compact ? 'text-xs' : 'text-md'} font-semibold truncate`}>{member.displayName}</p>
            </div>
            {mode?.ranked ? (
                <div className='mt-1 flex items-center justify-center gap-1.5'>
                    <img src={rank.imageSrc} alt='' className={`${compact ? 'w-5 h-5' : 'w-8 h-8'} absolute object-cover mr-8`} />
                    <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold tabular-nums ml-8`}>
                        {elo} <span className='text-[10px] font-medium text-neutral1'>SAT</span>
                    </p>
                </div>
            ) : null}
        </div>
    )
}

const PlayerSpot = ({ member, party, mode, currentProfile, focus = false, back = false, roomy = false, soloPlayer = false, twoPlayerParty = false, showLabel = true, showPodiumShadow = false, className = '' }) => {
    const memberProfile = member.userId === currentProfile?.uid
        ? currentProfile
        : { profile: { displayName: member.displayName, profilePicture: member.profilePicture, avatar: member.avatar } }

    const dimensions = back
        ? 'w-[12rem]! h-[12rem]!'
        : (focus
            ? (roomy ? 'w-[34rem]! h-[34rem]!' : 'w-[30rem]! h-[30rem]!')
            : (roomy ? 'w-[27rem]! h-[27rem]!' : 'w-[25rem]! h-[25rem]!'))
    const podiumSize = back
        ? 'w-36'
        : (focus
            ? (roomy ? 'w-[24rem]' : 'w-72 xl:w-80')
            : (roomy ? 'w-72' : 'w-56 xl:w-64'))
    // The artwork is intentionally twice as tall as it is wide. These offsets
    // keep the platform surface aligned with each avatar's feet while letting
    // the column extend below the stage.
    const podiumBottom = back
        ? '-bottom-[10rem]'
        : (focus
            ? (roomy ? (soloPlayer ? '-bottom-[29.75rem]' : (twoPlayerParty ? '-bottom-[30rem]' : '-bottom-[27rem]')) : '-bottom-[18rem] xl:-bottom-[22rem]')
            : (roomy ? '-bottom-[20rem]' : '-bottom-[15rem] xl:-bottom-[18rem]'))
    const spotHeight = back
        ? 'w-40 h-48'
        : (focus
            ? (roomy ? 'h-[33rem]' : 'h-[29rem]')
            : (roomy ? 'h-[28rem]' : 'h-[24rem]'))
    const characterLift = back ? '-translate-y-18' : '-translate-y-24'
    const podiumLift = !roomy && !back
        ? (focus ? 'translate-y-7' : 'translate-y-[0.125rem]')
        : (focus ? '' : (roomy ? 'translate-y-[0.875rem]' : '-translate-y-4'))
    const podiumHorizontalPosition = !roomy && !back && focus ? 'left-[calc(50%+0.625rem)]' : 'left-1/2'
    const characterHorizontalPosition = !roomy && !back && focus ? 'translate-x-[0.625rem]' : ''
    return (
        <div className={`relative flex items-end justify-center ${spotHeight} min-w-0 ${className}`}>
            {showLabel ? <PlayerLabel member={member} party={party} mode={mode} compact={back} /> : null}
            <Podium
                fadeBottom={back}
                glow={member.ready && !back}
                className={`absolute max-w-none! ${podiumSize} ${podiumBottom} ${podiumHorizontalPosition} -translate-x-1/2 ${podiumLift} ${showPodiumShadow ? 'drop-shadow-[0px_20px_14px_rgba(0,0,0,0.12)]' : ''}`}
            />
            <AvatarModel profile={memberProfile} animation='Idle' className={`${dimensions} ${characterLift} ${characterHorizontalPosition} relative z-10`} />
        </div>
    )
}

const AnimatedPlayerSpot = ({ playerRef, ...props }) => (
    <div ref={playerRef} className='min-w-0'>
        <PlayerSpot {...props} />
    </div>
)

const PartyStageActionButton = ({ action, label, onClick }) => (
    <button
        type='button'
        onClick={onClick}
        className='w-28 h-28 flex flex-col items-center justify-center gap-2.5 text-neutral1 cursor-pointer hover:scale-105 active:scale-95 group transition-transform'
    >
        <span className='w-12 h-12 rounded-full bg-neutral4 group-hover:bg-neutral3 flex items-center justify-center text-lg transition-colors'>
            {action === 'join' ? <FaRightToBracket /> : <FaPlus />}
        </span>
        <span className='text-sm font-semibold'>{label}</span>
    </button>
)

const OnlineInviteHint = ({ friends }) => {
    const cycleDuration = 6000
    const fadeDuration = 320
    const [friendIndex, setFriendIndex] = useState(0)
    const [showBlank, setShowBlank] = useState(false)
    const [visible, setVisible] = useState(true)
    const friendKey = friends.map((friend) => friend.uid).join('|')
    const currentFriend = showBlank ? null : friends[friendIndex % friends.length]

    useEffect(() => {
        setFriendIndex(0)
        setShowBlank(false)
        setVisible(true)
    }, [friendKey])

    useEffect(() => {
        if (!friends.length) return undefined

        const timeouts = []
        let cancelled = false
        const queueTimeout = (callback, delay) => {
            const timeout = window.setTimeout(callback, delay)
            timeouts.push(timeout)
        }
        const cycle = (isBlank) => {
            queueTimeout(() => {
                setVisible(false)
                queueTimeout(() => {
                    if (isBlank) {
                        setFriendIndex((index) => (index + 1) % friends.length)
                        setShowBlank(false)
                    } else {
                        setShowBlank(true)
                    }
                    setVisible(true)
                    if (!cancelled) cycle(!isBlank)
                }, fadeDuration)
            }, cycleDuration)
        }

        cycle(false)
        return () => {
            cancelled = true
            timeouts.forEach((timeout) => window.clearTimeout(timeout))
        }
    }, [friendKey, friends.length])

    if (!friends.length) return null

    const name = currentFriend?.profile?.displayName ?? 'Friend'

    return (
        <div className={`h-4 -mt-7 flex items-center gap-1.5 text-[11px] text-neutral1 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
            {currentFriend ? (
                <>
                    <span className='w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0' />
                    <span className='max-w-28 truncate'>{name}</span>
                </>
            ) : null}
        </div>
    )
}

const InviteSpot = ({ onInvite, onJoinParty, showJoinParty = false, onlineFriends = [], roomy = false, className = '' }) => (
    <div className={`relative -translate-y-40 ${roomy ? 'h-[28rem]' : 'h-[24rem]'} flex flex-col items-center justify-center gap-3 ${className}`}>
        <PartyStageActionButton action='invite' label='Invite player' onClick={onInvite}/>
        <OnlineInviteHint friends={onlineFriends} />
        {showJoinParty ? <PartyStageActionButton action='join' label='Join party' onClick={onJoinParty} /> : null}
    </div>
)

const PartyStage = ({ party, mode, currentProfile, friends = [], onInvite, onJoinParty, showJoinParty = false }) => {
    const playerNodesRef = useRef(new Map())
    const previousPlayerRectsRef = useRef(new Map())
    const hasMeasuredStageRef = useRef(false)
    const members = [
        ...(party?.members ?? []),
        ...createPreviewMembers(mode?.id ?? 'sat-classic'),
    ]
    const currentMember = members.find((member) => member.userId === currentProfile?.uid) ?? members[0]
    const otherMembers = members.filter((member) => member.userId !== currentMember?.userId)
    const memberIdKey = members.map((member) => member.userId).join('|')
    const onlineFriends = friends.filter((friend) => (
        friend.status === 'active' && !memberIdKey.split('|').includes(friend.uid)
    ))
    const heroMembers = otherMembers.slice(0, 2)
    const backMembers = otherMembers.slice(2)
    const leftMember = heroMembers[0] ?? null
    const rightMember = heroMembers[1] ?? null
    const backPositions = ['left-[4%]', 'right-[0%]', 'left-[24%]', 'right-[24%]', 'right-[29%]', 'left-[28%]']
    const invitePosition = members.length === 1 ? 'left' : (members.length === 2 ? 'right' : null)
    const singlePlayer = members.length === 1
    const twoPlayerParty = members.length === 2
    const roomy = members.length < 3
    const stageColumns = roomy
        ? 'grid-cols-[minmax(10rem,0.72fr)_minmax(21rem,1.25fr)_minmax(7rem,0.45fr)]'
        : 'grid-cols-[minmax(9rem,1fr)_minmax(16rem,1.25fr)_minmax(9rem,1fr)]'
    const playerRef = useCallback((userId) => (node) => {
        if (node) playerNodesRef.current.set(userId, node)
        else playerNodesRef.current.delete(userId)
    }, [])

    useLayoutEffect(() => {
        const currentRects = new Map()
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

        playerNodesRef.current.forEach((node, userId) => {
            const rect = node.getBoundingClientRect()
            currentRects.set(userId, rect)
            const previousRect = previousPlayerRectsRef.current.get(userId)

            if (!hasMeasuredStageRef.current || reduceMotion) return

            if (!previousRect) {
                node.animate(
                    [
                        { opacity: 0, transform: 'translateY(1rem) scale(0.94)' },
                        { opacity: 1, transform: 'translateY(0) scale(1)' },
                    ],
                    { duration: 380, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
                )
                return
            }

            const deltaX = previousRect.left - rect.left
            const deltaY = previousRect.top - rect.top
            if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return

            node.animate(
                [
                    { transform: `translate(${deltaX}px, ${deltaY}px)` },
                    { transform: 'translate(0, 0)' },
                ],
                { duration: 460, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
            )
        })

        previousPlayerRectsRef.current = currentRects
        hasMeasuredStageRef.current = true
    })

    return (
        <div className='relative flex-1 min-h-0 flex items-end justify-center px-1 pb-12'>
            {backMembers.length ? (
                <div className='absolute inset-x-0 bottom-60 z-5 h-48 opacity-70 pointer-events-none'>
                    {backMembers.map((member, index) => (
                        <div key={member.userId} className={`absolute bottom-0 ${backPositions[index]}`}>
                            <AnimatedPlayerSpot
                                playerRef={playerRef(member.userId)}
                                member={member}
                                party={party}
                                mode={mode}
                                currentProfile={currentProfile}
                                back
                                showLabel={false}
                            />
                        </div>
                    ))}
                </div>
            ) : null}

            <div className={`relative z-10 w-full grid ${stageColumns} items-end`}>
                {leftMember ? (
                    <AnimatedPlayerSpot playerRef={playerRef(leftMember.userId)} member={leftMember} party={party} mode={mode} currentProfile={currentProfile} roomy={roomy} twoPlayerParty={twoPlayerParty} className='relative z-10 translate-x-20 -translate-y-16' />
                ) : (invitePosition === 'left' ? <InviteSpot onInvite={onInvite} onJoinParty={onJoinParty} showJoinParty={showJoinParty} onlineFriends={onlineFriends} roomy={roomy} className={singlePlayer ? 'translate-x-12' : ''} /> : <div />)}

                {currentMember ? (
                    <AnimatedPlayerSpot playerRef={playerRef(currentMember.userId)} member={currentMember} party={party} mode={mode} currentProfile={currentProfile} focus roomy={roomy} soloPlayer={singlePlayer} twoPlayerParty={twoPlayerParty} showPodiumShadow={!singlePlayer} className={`relative z-20 ${singlePlayer ? 'translate-x-16' : ''}`} />
                ) : null}

                {rightMember ? (
                    <AnimatedPlayerSpot playerRef={playerRef(rightMember.userId)} member={rightMember} party={party} mode={mode} currentProfile={currentProfile} roomy={roomy} className='relative z-10 -translate-x-12 -translate-y-16' />
                ) : (invitePosition === 'right' ? <InviteSpot onInvite={onInvite} onJoinParty={onJoinParty} showJoinParty={showJoinParty} onlineFriends={onlineFriends} roomy={roomy} /> : <div />)}
            </div>
        </div>
    )
}

export default PartyStage
