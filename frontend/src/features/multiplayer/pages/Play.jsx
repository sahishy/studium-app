import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import ProgressBar from '../../../shared/components/ui/ProgressBar'
import { useUserStats } from '../../profile/contexts/UserStatsContext'
import { getModeStats, getRankInfoFromElo } from '../../profile/utils/statsUtils'
import { useMultiplayer } from '../contexts/MultiplayerContext'
import { useToast } from '../../../shared/contexts/ToastContext'
import { useModal } from '../../../shared/contexts/ModalContext'
import MatchmakingToast from '../components/toasts/MatchmakingToast'
import { HiChevronDoubleUp } from 'react-icons/hi'
import { FaTrophy, FaChartSimple } from 'react-icons/fa6'
import {
    buildMultiplayerUiState,
    buildSingleplayerUiState,
    GAME_MODES,
    getModeById,
    getQueueState,
    MATCH_JOIN_DELAY_SECONDS,
} from '../utils/multiplayerUtils'
import GameModeTab from '../components/GameModeTab'
import GameModeThumbnail from '../components/GameModeThumbnail'
import GameModeStatsModal from '../components/modals/GameModeStatsModal'
import TextTooltip from '../../../shared/components/tooltips/TextTooltip'
import PlayBackground from '../components/PlayBackground'
import PartyStage from '../components/PartyStage'
import { createSocket, message } from '../services/realtimeSocketService'
import { useFriends } from '../../socials/contexts/FriendsContext'
import PartyInviteModal from '../components/modals/PartyInviteModal'
import ChatBox from '../components/ChatBox'
import JoinPartyModal from '../components/modals/JoinPartyModal'
import LoadingState from '../../../shared/components/ui/LoadingState'
import BottomFade from '../../../shared/components/ui/BottomFade'
import { useOnboarding } from '../../onboarding/OnboardingContext'

const SELECTED_MODE_STORAGE_KEY = 'play:lastSelectedModeId'
const PLAYER_COUNT_WINDOW_MS = 15 * 1000
const PLAYER_COUNT_MODES = {
    'sat-classic': { seed: 173, multiplier: 1.2 },
    'sat-timber': { seed: 359, multiplier: 1.1 },
    'sat-puncture': { seed: 541, multiplier: 1.1 },
    'sat-flutter': { seed: 727, multiplier: 1.0 },
}

// A shared, time-based display count, rather than a live presence measurement.
const getDisplayPlayerCount = (modeId, time = Date.now()) => {
    const mode = PLAYER_COUNT_MODES[modeId] ?? { seed: 911, multiplier: 1.0 }
    const tick = Math.floor(time / PLAYER_COUNT_WINDOW_MS)
    const phase = mode.seed * Math.PI / 180
    // Blend 20- and 7-minute waves for gradual, predictable movement.
    const wave = 0.75 * Math.sin(tick * 2 * Math.PI / 40 + phase)
        + 0.25 * Math.sin(tick * 2 * Math.PI / 14 + phase)
    // Leave room for the 1.2x multiplier while keeping every mode in 150–200.
    const baseCount = 150 + ((wave + 1) / 2) * (200 / 1.2 - 150)
    return Math.round(baseCount * mode.multiplier)
}

const getStoredSelectedModeId = () => {
    try {
        const storedModeId = window.localStorage.getItem(SELECTED_MODE_STORAGE_KEY)
        return GAME_MODES.some((mode) => mode.id === storedModeId) ? storedModeId : 'sat-classic'
    } catch {
        return 'sat-classic'
    }
}

const Play = () => {

    const { profile } = useOutletContext()
    const navigate = useNavigate()
    const { userStats } = useUserStats()
    const { matchmaking, session, error: realtimeError, joinQueue, leaveQueue, findMatch, startSoloGame, createPartyAndInvite, joinParty, leaveParty } = useMultiplayer()
    const { friends } = useFriends()
    const { toastStack, showToast, updateToast, hideToast } = useToast()
    const { openModal, closeModal } = useModal()
    const { active: tutorial } = useOnboarding()

    const [selectedModeId, setSelectedModeId] = useState(getStoredSelectedModeId)
    const [playerCountTime, setPlayerCountTime] = useState(Date.now)

    useEffect(() => {
        let timeoutId
        const updateCount = () => {
            setPlayerCountTime(Date.now())
            timeoutId = window.setTimeout(updateCount, PLAYER_COUNT_WINDOW_MS - (Date.now() % PLAYER_COUNT_WINDOW_MS))
        }
        updateCount()
        window.addEventListener('focus', updateCountOnFocus)
        function updateCountOnFocus() {
            window.clearTimeout(timeoutId)
            updateCount()
        }
        return () => {
            window.clearTimeout(timeoutId)
            window.removeEventListener('focus', updateCountOnFocus)
        }
    }, [])
    const scrollRef = useRef(null)
    const [activePlayTab, setActivePlayTab] = useState('lobby')
    const showModePicker = activePlayTab === 'modes' && !tutorial
    const [matchCountdownSeconds, setMatchCountdownSeconds] = useState(MATCH_JOIN_DELAY_SECONDS)
    const [isQueueingOptimistic, setIsQueueingOptimistic] = useState(false)
    const matchmakingToastIdRef = useRef(null)
    const autoJoinRoomIdRef = useRef(null)
    const partySocketRef = useRef(null)
    const [party, setParty] = useState(null)
    const [partyError, setPartyError] = useState(null)

    const activeModeId = party?.modeId ?? selectedModeId
    const displayPlayerCount = getDisplayPlayerCount(activeModeId, playerCountTime)
    const selectedMode = useMemo(() => getModeById(activeModeId), [activeModeId])
    const isSelectedModeMultiplayer = selectedMode?.type === 'multiplayer'

    const multiplayerUi = buildMultiplayerUiState({ userStats, modeId: activeModeId })
    const singleplayerUi = buildSingleplayerUiState({ userStats, modeId: activeModeId })

    const {
        rankedStats,
        rankInfo,
        currentTierMinElo,
        currentTierSpan,
        currentTierProgress,
        eloToNextTier,
        rankLabel,
        nextTierLabel,
        nextTierThreshold,
        placement,
    } = multiplayerUi

    const { singleplayerStats } = singleplayerUi
    const nextTierIcon = nextTierThreshold
        ? getRankInfoFromElo(nextTierThreshold.minElo).imageSrc
        : null

    const queueState = getQueueState(session)
    const queueStateForMode = isSelectedModeMultiplayer ? queueState : 'idle'
    const effectiveQueueState = (
        queueStateForMode === 'matched'
            ? 'matched'
            : (queueStateForMode === 'queueing' || isQueueingOptimistic ? 'queueing' : 'idle')
    )

    const ModeIcon = selectedMode?.icon;
    const isInParty = Boolean(session?.partyId)
    const isPartyLoading = isInParty && (!party || party.id !== session.partyId)
    const isPartyLeader = party?.leaderUserId === profile?.uid
    const modeSelectionDisabled = Boolean(tutorial) || (isInParty && !isPartyLeader)
    const partyPlayerCount = selectedMode?.playerCount ?? 1
    const partyOverCapacity = (party?.members?.length ?? 0) > partyPlayerCount
    const currentPartyMember = party?.members?.find((member) => member.userId === profile?.uid)
    const stageParty = useMemo(() => {
        if(party) return party
        return {
            id: null,
            leaderUserId: profile?.uid,
            members: [{
                userId: profile?.uid,
                displayName: profile?.profile?.displayName || 'Player',
                profilePicture: profile?.profile?.profilePicture ?? null,
                avatar: profile?.profile?.avatar ?? null,
                title: profile?.profile?.title ?? null,
                level: profile?.progress?.level ?? 1,
                eloByMode: Object.fromEntries(Object.keys(userStats?.play ?? {}).map((modeId) => [modeId, getModeStats(userStats, { id: modeId }).elo ?? 0])),
                ready: false,
            }],
        }
    }, [party, profile, userStats])

    useEffect(() => {
        try {
            window.localStorage.setItem(SELECTED_MODE_STORAGE_KEY, selectedModeId)
        } catch {
            // Keep mode selection functional when browser storage is unavailable.
        }
    }, [selectedModeId])

    useEffect(() => {
        if (party?.modeId && GAME_MODES.some((mode) => mode.id === party.modeId)) {
            setSelectedModeId(party.modeId)
        }
    }, [party?.modeId])

    useEffect(() => {
        if(!session?.partyId) {
            partySocketRef.current?.close()
            partySocketRef.current = null
            setParty(null)
            setPartyError(null)
            return () => {}
        }

        const socket = createSocket({ party: 'party', room: session.partyId })
        partySocketRef.current = socket
        const onMessage = (event) => {
            try {
                const incoming = JSON.parse(event.data)
                if(incoming.type === 'party.snapshot') {
                    setParty(incoming.payload)
                    setPartyError(null)
                }
                if(incoming.type === 'error') setPartyError(incoming.payload?.message ?? 'Party request failed.')
            } catch {
                setPartyError('Unable to read the party state.')
            }
        }
        socket.addEventListener('message', onMessage)
        return () => {
            socket.removeEventListener('message', onMessage)
            socket.close()
            if(partySocketRef.current === socket) partySocketRef.current = null
        }
    }, [session?.partyId])

    const sendPartyMessage = (type, payload = {}) => {
        const socket = partySocketRef.current
        if(!socket) return
        const sendNow = () => socket.send(message(type, payload))
        if(socket.readyState === WebSocket.OPEN) sendNow()
        else socket.addEventListener('open', sendNow, { once: true })
    }

    const openPartyInviteModal = () => {
        openModal({
            content: (
                <PartyInviteModal
                    currentUserId={profile?.uid}
                    memberIds={stageParty.members.map((member) => member.userId)}
                    pendingInviteUserIds={(party?.pendingInvites ?? []).map((invite) => invite.userId)}
                    friends={friends}
                    onInvite={(userId) => (
                        party
                            ? sendPartyMessage('party.invite', { userId })
                            : createPartyAndInvite({ userId })
                    )}
                    closeModal={closeModal}
                />
            ),
            maxWidthClass: 'max-w-md',
        })
    }

    const openJoinPartyModal = () => {
        openModal({
            content: <JoinPartyModal onJoin={(partyId) => joinParty({ partyId })} closeModal={closeModal} />,
            maxWidthClass: 'max-w-md',
        })
    }

    // Keep the tutorial's lobby targets mounted, including between spotlights.
    const openModePicker = () => {
        if(modeSelectionDisabled)return
        setActivePlayTab('modes')
    }

    const selectGameMode = (modeId) => {
        if(modeSelectionDisabled)return
        if(isInParty) sendPartyMessage('party.selectMode', { modeId })
        else setSelectedModeId(modeId)
        setActivePlayTab('lobby')
    }

    // The mode list and the lobby share one scroll container, and only the mode list scrolls.
    // Leaving the list while scrolled down used to keep that scrollTop on a now overflow-hidden
    // container, so the lobby stayed shifted up with no way to scroll back.
    useLayoutEffect(() => {
        if(scrollRef.current) scrollRef.current.scrollTop = 0
    }, [showModePicker])

    useEffect(() => {
        if (queueStateForMode !== 'idle') {
            setIsQueueingOptimistic(false)
        }
    }, [queueStateForMode])

    useEffect(() => {
        if (!isSelectedModeMultiplayer || queueStateForMode === 'idle') {
            return
        }

        const existingMatchmakingToasts = toastStack.filter((toastEntry) => toastEntry.component === MatchmakingToast)

        if (existingMatchmakingToasts.length === 0) {
            return
        }

        const currentToastStillExists = existingMatchmakingToasts.some((toastEntry) => toastEntry.id === matchmakingToastIdRef.current)
        if (!currentToastStillExists) {
            matchmakingToastIdRef.current = existingMatchmakingToasts[0].id
        }

        existingMatchmakingToasts.forEach((toastEntry) => {
            if (toastEntry.id !== matchmakingToastIdRef.current) {
                hideToast(toastEntry.id, { force: true })
            }
        })
    }, [isSelectedModeMultiplayer, queueStateForMode, toastStack, hideToast])

    const handleLeaveQueue = async () => {
        await leaveQueue()

        if (matchmakingToastIdRef.current) {
            hideToast(matchmakingToastIdRef.current, { force: true })
            matchmakingToastIdRef.current = null
        }
    }

    const showOrUpdateMatchmakingToast = (state) => {
        if (!matchmakingToastIdRef.current) {
            const existingMatchmakingToasts = toastStack.filter((toastEntry) => toastEntry.component === MatchmakingToast)
            if (existingMatchmakingToasts.length > 0) {
                matchmakingToastIdRef.current = existingMatchmakingToasts[0].id
            }
        }

        if (matchmakingToastIdRef.current) {
            const toastExists = toastStack.some((toastEntry) => toastEntry.id === matchmakingToastIdRef.current)
            if (!toastExists) {
                matchmakingToastIdRef.current = null
            }
        }

        const toastProps = {
            state,
            queuedAt: matchmaking?.queuedAt,
            matchCountdownSeconds,
            onLeaveQueue: handleLeaveQueue,
        }

        if (!matchmakingToastIdRef.current) {
            const toastId = showToast({
                component: MatchmakingToast,
                props: toastProps,
                duration: null,
            })

            matchmakingToastIdRef.current = toastId
            return
        }

        updateToast(matchmakingToastIdRef.current, {
            props: toastProps,
            duration: null,
        })
    }

    const handlePlayClick = async () => {

        if (!profile?.uid || effectiveQueueState !== 'idle') {
            return
        }

        if(isInParty) {
            if(!party || partyOverCapacity) return
            sendPartyMessage('party.ready', { ready: !currentPartyMember?.ready })
            return
        }

        if (!isSelectedModeMultiplayer) {
            await startSoloGame({ modeId: selectedModeId })
            return
        }

        setIsQueueingOptimistic(true)

        try {
            await joinQueue({
                modeId: activeModeId,
                elo: rankedStats.elo,
                displayName: profile?.profile?.displayName || 'A player',
                profilePicture: profile?.profile?.profilePicture ?? null,
            })

            await findMatch({
                modeId: activeModeId,
            })
        } catch (error) {
            setIsQueueingOptimistic(false)
            throw error
        }
    }

    // The matchmaking toast lives in a provider above this screen, so it outlives the screen.
    // Hiding it only on the countdown path left it on top of the match whenever something else
    // navigated first - a session redirect straight into an already-open room, for instance.
    useEffect(() => () => {
        if (matchmakingToastIdRef.current) {
            hideToast(matchmakingToastIdRef.current, { force: true })
            matchmakingToastIdRef.current = null
        }
    }, [hideToast])

    useEffect(() => {
        if (!isSelectedModeMultiplayer || queueStateForMode !== 'matched' || !session?.currentRoomId) {
            autoJoinRoomIdRef.current = null
            setMatchCountdownSeconds(MATCH_JOIN_DELAY_SECONDS)
            return
        }

        if (autoJoinRoomIdRef.current !== session.currentRoomId) {
            autoJoinRoomIdRef.current = session.currentRoomId
            setMatchCountdownSeconds(MATCH_JOIN_DELAY_SECONDS)
        }
    }, [isSelectedModeMultiplayer, queueStateForMode, session?.currentRoomId])

    useEffect(() => {
        if (!isSelectedModeMultiplayer || queueStateForMode !== 'matched' || !session?.currentRoomId) {
            return
        }

        if (matchCountdownSeconds <= 0) {
            if (matchmakingToastIdRef.current) {
                hideToast(matchmakingToastIdRef.current, { force: true })
                matchmakingToastIdRef.current = null
            }
            navigate(`/play/game/${session.currentRoomId}`)
            return
        }

        const timeoutId = setTimeout(() => {
            setMatchCountdownSeconds((previous) => previous - 1)
        }, 1000)

        return () => clearTimeout(timeoutId)
    }, [isSelectedModeMultiplayer, queueStateForMode, session?.currentRoomId, matchCountdownSeconds, navigate, hideToast])

    useEffect(() => {
        if (!isSelectedModeMultiplayer || queueStateForMode === 'idle') {
            if (matchmakingToastIdRef.current) {
                hideToast(matchmakingToastIdRef.current, { force: true })
                matchmakingToastIdRef.current = null
            }
            return
        }

        showOrUpdateMatchmakingToast(queueStateForMode === 'matched' ? 'matched' : 'queueing')
    }, [isSelectedModeMultiplayer, queueStateForMode, matchCountdownSeconds, matchmaking?.queuedAt])

    return (
        <div
            ref={scrollRef}
            className={`flex flex-col h-full overflow-x-hidden ${showModePicker ? 'overflow-y-auto' : 'overflow-y-auto lg:overflow-hidden'}`}
        >
            <Topbar
                profile={profile}
                party={isInParty ? party : null}
                onLeaveParty={leaveParty}
            />

            <PlayBackground />

            {showModePicker ? (
                <GameModeTab
                    modes={isInParty ? GAME_MODES.filter((mode) => mode.supportsPartyGames) : GAME_MODES}
                    selectedModeId={activeModeId}
                    onSelectMode={selectGameMode}
                    onBack={() => setActivePlayTab('lobby')}
                />
            ) : (
                <div className='relative w-full flex-1 flex flex-col lg:flex-row min-h-0 px-4 sm:px-8 xl:px-16 pb-0 pt-2 gap-5 xl:gap-7'>

                    {isPartyLoading ? <LoadingState className='flex-1 min-h-0' /> : <>

                    <PartyStage
                        party={stageParty}
                        mode={selectedMode}
                        currentProfile={profile}
                        friends={friends}
                        onInvite={openPartyInviteModal}
                        onJoinParty={openJoinPartyModal}
                        showJoinParty={!isInParty}
                    />

                <div className='w-full min-h-0 max-w-sm lg:max-w-[19rem] self-center lg:self-stretch shrink-0 gap-4 flex flex-col lg:[justify-content:safe_center] lg:overflow-y-auto no-scrollbar pt-2 pb-8'>

                    <div data-onboarding="lobby:game-card" className='group/mode relative isolate mt-10 shrink-0'>
                        <div className="hidden lg:block"><GameModeThumbnail
                            mode={selectedMode}
                            disabled={modeSelectionDisabled}
                            disabledReason={tutorial ? 'Finish the tutorial to change gamemodes' : undefined}
                            onClick={openModePicker}
                        /></div>
                    <Card className='z-10 max-w-8xl p-5! gap-2! items-center'>
                        <div className='absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10'>
                            <TextTooltip text='Leaderboards' placement='top' className='shrink-0'>
                                <button
                                    type='button'
                                    aria-label='View leaderboards'
                                    onClick={() => navigate(`/leaderboards?mode=${encodeURIComponent(selectedMode.ranked ? activeModeId : 'total')}`)}
                                    className='size-8 flex items-center justify-center rounded-lg border border-neutral4 bg-neutral6 dark:bg-neutral5 text-neutral1 hover:text-neutral0 hover:bg-neutral5 dark:hover:bg-neutral4 shadow-sm shadow-shadow transition cursor-pointer'
                                >
                                    <FaTrophy className='text-sm' />
                                </button>
                            </TextTooltip>
                            <button type='button' data-onboarding='lobby:modes' className='gamemode-trigger rounded-xl cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral2'
                                disabled={modeSelectionDisabled} onClick={openModePicker} aria-label='Change gamemode'>
                            <Card className='font-semibold flex-row! items-center gap-3! whitespace-nowrap'>
                                <ModeIcon className='text-lg' />
                                {selectedMode.name}
                            </Card>
                            </button>
                            <TextTooltip text='View stats' placement='top' className='shrink-0'>
                                <button
                                    type='button'
                                    aria-label='View game mode stats'
                                    onClick={() => openModal({
                                        content: <GameModeStatsModal mode={selectedMode} gamesPlayed={userStats?.play?.[activeModeId]?.gamesPlayed} closeModal={closeModal} />,
                                        maxWidthClass: 'max-w-sm',
                                    })}
                                    className='size-8 flex items-center justify-center rounded-lg border border-neutral4 bg-neutral6 dark:bg-neutral5 text-neutral1 hover:text-neutral0 hover:bg-neutral5 dark:hover:bg-neutral4 shadow-sm shadow-shadow transition cursor-pointer'
                                >
                                    <FaChartSimple className='text-sm' />
                                </button>
                            </TextTooltip>
                        </div>
                        {isSelectedModeMultiplayer ? (
                            <>
                                <div data-onboarding="lobby:rank" className='flex flex-col items-center gap-3'>

                                    <div className='absolute mt-4 w-20 h-20 overflow-hidden flex items-center justify-center'>
                                        <img
                                            src={rankInfo.imageSrc}
                                            alt={`${rankLabel} icon`}
                                            className='w-24 h-24 object-cover'
                                        />
                                    </div>

                                    <div className='flex items-center gap-3 mt-24'>
                                        <h2 className='text-lg font-semibold'>{rankLabel}</h2>
                                    </div>

                                </div>

                                <ProgressBar
                                    value={placement.placed ? currentTierProgress : placement.gamesPlayed}
                                    max={placement.placed ? currentTierSpan : placement.required}
                                    secondaryValue={placement.placed ? Math.max(0, rankedStats.peakElo - currentTierMinElo) : null}
                                    secondaryMax={currentTierSpan}
                                    secondaryClassName='bg-sky-300/40'
                                />

                                {!placement.placed ? (
                                    <p className='w-full text-center text-sm text-neutral1'>{nextTierLabel}</p>
                                ) : (
                                    <div className='flex justify-between w-full'>
                                        <p className='text-sm font-semibold'>
                                            {rankedStats.elo} <span className='text-xs text-neutral1'>SAT</span>
                                        </p>
                                        <p className='text-sm text-neutral1 flex items-center gap-1'>
                                            <HiChevronDoubleUp />
                                            {nextTierThreshold ?
                                                <span className='flex items-center gap-1'>
                                                    {eloToNextTier} to
                                                    <span className='ml-1 mb-0.5 flex items-center justify-center w-4 h-4 opacity-60'><img src={nextTierIcon} alt={`${nextTierLabel} icon`} className='absolute w-7 h-7 object-cover'/></span>
                                                    {nextTierLabel}
                                                </span>
                                            :
                                                <span>{nextTierLabel}</span>
                                            }
                                        </p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className='flex flex-col items-center gap-3 mt-6'>
                                    <p className='text-sm font-semibold text-neutral1'>High Score</p>
                                    <p className='text-6xl font-bold'>{singleplayerStats.peakScore}</p>
                                </div>
                            </>
                        )}
                    </Card>
                    </div>

                    <div className='flex flex-col gap-3 shrink-0'>
                        <Button
                            type='primary'
                            className='p-4! text-xl! font-bold! w-full'
                            data-onboarding="lobby:play"
                            onClick={handlePlayClick}
                            disabled={effectiveQueueState !== 'idle' || (isInParty && (!party || partyOverCapacity))}
                            loading={!isInParty && effectiveQueueState === 'queueing'}
                        >
                            {isInParty
                                ? (currentPartyMember?.ready ? 'UNREADY' : 'READY')
                                : (effectiveQueueState === 'queueing' ? 'QUEUEING' : effectiveQueueState === 'matched' ? 'JOINING' : 'PLAY')}
                        </Button>
                        <p className='flex items-center justify-center gap-1.5 text-xs text-neutral1'>
                            <span aria-hidden='true' className='size-1.5 rounded-full bg-green-400' />
                            {displayPlayerCount} players online
                        </p>
                    </div>

                    {realtimeError || partyError ? <p className='text-sm text-red-400 text-center'>{partyError || realtimeError.message}</p> : null}

                    </div>
                    </>}
                </div>
            )}

            {isInParty && party ? (
                <ChatBox
                    userId={profile?.uid}
                    senderName={profile?.profile?.displayName}
                    messages={party.chat ?? []}
                    onSendMessage={({ text, clientMessageId }) => sendPartyMessage('chat.send', { text, clientMessageId })}
                    className='z-[100]'
                />
            ) : null}
            {activePlayTab === 'modes' ? <BottomFade scrollRef={scrollRef} /> : null}
        </div>
    )

}

export default Play
