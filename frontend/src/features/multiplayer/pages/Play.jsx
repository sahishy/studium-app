import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import ProgressBar from '../../../shared/components/ui/ProgressBar'
import { useUserStats } from '../../profile/contexts/UserStatsContext'
import { useMultiplayer } from '../contexts/MultiplayerContext'
import { useToast } from '../../../shared/contexts/ToastContext'
import { useModal } from '../../../shared/contexts/ModalContext'
import MatchmakingToast from '../components/toasts/MatchmakingToast'
import { HiChevronDoubleUp } from 'react-icons/hi'
import {
    buildMultiplayerUiState,
    buildSingleplayerUiState,
    GAME_MODES,
    getModeById,
    getQueueState,
    MATCH_JOIN_DELAY_SECONDS,
} from '../utils/multiplayerUtils'
import GameModeModal from '../components/modals/GameModeModal'
import TextTooltip from '../../../shared/components/tooltips/TextTooltip'
import PlayBackground from '../components/PlayBackground'
import PartyStage from '../components/PartyStage'
import { createSocket, message } from '../services/realtimeSocketService'
import { useFriends } from '../../socials/contexts/FriendsContext'
import PartyInviteModal from '../components/modals/PartyInviteModal'
import ChatBox from '../components/ChatBox'
import JoinPartyModal from '../components/modals/JoinPartyModal'
import LoadingState from '../../../shared/components/ui/LoadingState'

const SELECTED_MODE_STORAGE_KEY = 'play:lastSelectedModeId'

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

    const [selectedModeId, setSelectedModeId] = useState(getStoredSelectedModeId)
    const [matchCountdownSeconds, setMatchCountdownSeconds] = useState(MATCH_JOIN_DELAY_SECONDS)
    const [isQueueingOptimistic, setIsQueueingOptimistic] = useState(false)
    const matchmakingToastIdRef = useRef(null)
    const autoJoinRoomIdRef = useRef(null)
    const partySocketRef = useRef(null)
    const [party, setParty] = useState(null)
    const [partyError, setPartyError] = useState(null)

    const activeModeId = party?.modeId ?? selectedModeId
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
    } = multiplayerUi

    const { singleplayerStats } = singleplayerUi

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
                eloByMode: Object.fromEntries(Object.entries(userStats?.play ?? {}).map(([modeId, stats]) => [modeId, Number(stats?.elo) || 0])),
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

    const openGameModeModal = () => {
        openModal(
            {
                content: (
                    <GameModeModal
                        modes={isInParty ? GAME_MODES.filter((mode) => mode.supportsPartyGames) : GAME_MODES}
                        selectedModeId={activeModeId}
                        onSelectMode={(modeId) => {
                            if(isInParty) sendPartyMessage('party.selectMode', { modeId })
                            else setSelectedModeId(modeId)
                            closeModal()
                        }}
                    />
                ),
                maxWidthClass: 'max-w-3xl',
            }
        )
    }

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
        <div className='relative flex flex-col h-full overflow-hidden'>
            <Topbar
                profile={profile}
                party={isInParty ? party : null}
                onLeaveParty={leaveParty}
            />

            <PlayBackground />

            <div className='relative w-full flex-1 flex min-h-0 px-8 xl:px-16 pb-0 pt-2 gap-5 xl:gap-7'>

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

                <div className='w-full min-h-0 max-w-[19rem] gap-4 flex flex-col justify-center pb-8'>

                    <Card className='max-w-8xl p-5! gap-2! items-center'>
                        <Card className='absolute! -top-7 font-semibold flex-row items-center gap-3!'>
                            <ModeIcon className='text-lg' />
                            {selectedMode.name}
                        </Card>
                        {isSelectedModeMultiplayer ? (
                            <>
                                <div className='flex flex-col items-center gap-3'>

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
                                    value={currentTierProgress}
                                    max={currentTierSpan}
                                    secondaryValue={Math.max(0, rankedStats.peakElo - currentTierMinElo)}
                                    secondaryMax={currentTierSpan}
                                    secondaryClassName='bg-sky-300/40'
                                />

                                <div className='flex justify-between w-full'>
                                    <p className='text-sm font-semibold'>
                                        {rankedStats.elo} <span className='text-xs text-neutral1'>SAT</span>
                                    </p>
                                    <p className='text-sm text-neutral1 flex items-center gap-1'>
                                        <HiChevronDoubleUp />
                                        {nextTierThreshold ? `${eloToNextTier} to ${nextTierLabel}` : nextTierLabel}
                                    </p>
                                </div>
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

                    <div className='flex gap-3'>
                        <Button
                            type='primary'
                            className='p-4! text-xl! font-bold! flex-3'
                            onClick={handlePlayClick}
                            disabled={effectiveQueueState !== 'idle' || (isInParty && (!party || partyOverCapacity))}
                            loading={!isInParty && effectiveQueueState === 'queueing'}
                        >
                            {isInParty
                                ? (currentPartyMember?.ready ? 'UNREADY' : 'READY')
                                : (effectiveQueueState === 'queueing' ? 'QUEUEING' : effectiveQueueState === 'matched' ? 'JOINING' : 'PLAY')}
                        </Button>
                        <TextTooltip text={isInParty && !isPartyLeader ? 'Party Leader Only' : 'Change mode'} className='flex-1' placement='top'>
                            <button
                                onClick={openGameModeModal}
                                disabled={isInParty && !isPartyLeader}
                                className='block w-full h-full appearance-none bg-transparent border-0 p-0 m-0 text-inherit leading-none align-top disabled:opacity-50 disabled:cursor-not-allowed'
                            >
                                <Card className='w-full h-full justify-center items-center hover:bg-neutral5 dark:hover:bg-neutral4 transition cursor-pointer'>
                                    <ModeIcon className='text-2xl' />
                                </Card>
                            </button>
                        </TextTooltip>
                    </div>

                    {realtimeError || partyError ? <p className='text-sm text-red-400 text-center'>{partyError || realtimeError.message}</p> : null}

                </div>
                </>}
            </div>

            {isInParty && party ? (
                <ChatBox
                    userId={profile?.uid}
                    senderName={profile?.profile?.displayName}
                    messages={party.chat ?? []}
                    onSendMessage={({ text, clientMessageId }) => sendPartyMessage('chat.send', { text, clientMessageId })}
                    className='z-[100]'
                />
            ) : null}
        </div>
    )

}

export default Play
