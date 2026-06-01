import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import AvatarModel from '../../../shared/components/avatar/AvatarModel'
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
import Podium from '../../../shared/components/avatar/Podium'
import GameModeModal from '../components/modals/GameModeModal'
import TextTooltip from '../../../shared/components/tooltips/TextTooltip'
import PlayBackground from '../components/PlayBackground'

const Play = () => {

    const { profile } = useOutletContext()
    const navigate = useNavigate()
    const { userStats } = useUserStats()
    const { matchmaking, session, joinQueue, leaveQueue, findMatch } = useMultiplayer()
    const { toastStack, showToast, updateToast, hideToast } = useToast()
    const { openModal, closeModal } = useModal()

    const [selectedModeId, setSelectedModeId] = useState('sat-classic')
    const [matchCountdownSeconds, setMatchCountdownSeconds] = useState(MATCH_JOIN_DELAY_SECONDS)
    const [isQueueingOptimistic, setIsQueueingOptimistic] = useState(false)
    const matchmakingToastIdRef = useRef(null)
    const autoJoinRoomIdRef = useRef(null)

    const selectedMode = useMemo(() => getModeById(selectedModeId), [selectedModeId])
    const isSelectedModeMultiplayer = selectedMode?.type === 'multiplayer'

    const multiplayerUi = buildMultiplayerUiState({ userStats, modeId: selectedModeId })
    const singleplayerUi = buildSingleplayerUiState({ userStats, modeId: selectedModeId })

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

    const openGameModeModal = () => {
        openModal(
            {
                content: (
                    <GameModeModal
                        modes={GAME_MODES}
                        selectedModeId={selectedModeId}
                        closeModal={closeModal}
                        onSelectMode={(modeId) => {
                            setSelectedModeId(modeId)
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

        if (!isSelectedModeMultiplayer) {
            return
        }

        setIsQueueingOptimistic(true)

        try {
            await joinQueue({
                modeId: selectedModeId,
                elo: rankedStats.elo,
                displayName: profile?.profile?.displayName || 'A player',
                profilePicture: profile?.profile?.profilePicture ?? null,
            })

            await findMatch({
                modeId: selectedModeId,
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
            navigate(`/play/room/${session.currentRoomId}`)
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
        <div className='flex flex-col h-full overflow-hidden'>
            <Topbar profile={profile} />

            <PlayBackground />

            <div className='relative w-full flex-1 flex min-h-0 px-24 pb-24 pt-2 gap-8'>

                <div className='relative flex-1 flex items-center justify-center min-h-0'>
                    <Podium className={'absolute -bottom-52'} />
                    <AvatarModel
                        profile={profile}
                        animation={'Idle'}
                        className='w-[36rem]! h-[36rem]!'
                    />
                </div>

                <div className='flex-1 min-h-0 max-w-sm flex flex-col justify-center gap-8'>

                    {isSelectedModeMultiplayer ? (
                        <Card className='max-w-xl p-8! gap-3'>
                            <div className='flex flex-col items-center gap-3'>

                                <div className="w-32 h-32 overflow-hidden flex items-center justify-center">
                                    <img
                                        src={rankInfo.imageSrc}
                                        alt={`${rankLabel} icon`}
                                        className='w-32 h-32 object-cover'
                                    />
                                </div>

                                <div className='flex items-center gap-3'>
                                    <ModeIcon className='text-lg mb-1' />
                                    <h2 className='text-2xl font-semibold'>{rankLabel}</h2>
                                </div>

                            </div>

                            <ProgressBar
                                value={currentTierProgress}
                                max={currentTierSpan}
                                secondaryValue={Math.max(0, rankedStats.peakElo - currentTierMinElo)}
                                secondaryMax={currentTierSpan}
                                secondaryClassName='bg-sky-300/40'
                            />

                            <div className='flex justify-between'>
                                <p className='text-sm font-semibold'>
                                    {rankedStats.elo} <span className='text-xs text-neutral1'>SAT</span>
                                </p>
                                <p className='text-sm text-neutral1 flex items-center gap-1'>
                                    <HiChevronDoubleUp />
                                    {nextTierThreshold ? `${eloToNextTier} to ${nextTierLabel}` : nextTierLabel}
                                </p>
                            </div>

                        </Card>
                    ) : (
                        <Card className='max-w-xl p-8! gap-3 items-center'>

                            <div className='flex items-center gap-3'>
                                <ModeIcon className='text-lg mb-1' />
                                <h2 className='text-2xl font-semibold'>{selectedMode.name}</h2>
                            </div>

                            <div className='flex flex-col items-center gap-3'>
                                <p className='text-sm font-semibold text-neutral1'>High Score</p>
                                <p className='text-6xl font-bold'>{singleplayerStats.peakScore}</p>
                            </div>

                        </Card>
                    )}

                    <div className='flex gap-3'>
                        <Button
                            type='primary'
                            className='p-6! text-2xl! font-bold! flex-3'
                            onClick={handlePlayClick}
                            disabled={effectiveQueueState !== 'idle'}
                            loading={effectiveQueueState === 'queueing'}
                        >
                            {effectiveQueueState === 'queueing' ? 'QUEUEING' : effectiveQueueState === 'matched' ? 'JOINING' : 'PLAY'}
                        </Button>
                        <TextTooltip text={'Change mode'} className='flex-1' placement='top'>
                            <button
                                onClick={openGameModeModal}
                                className='block w-full h-full appearance-none bg-transparent border-0 p-0 m-0 text-inherit leading-none align-top'
                            >
                                <Card className='w-full h-full justify-center items-center hover:bg-neutral5 dark:hover:bg-neutral4 transition cursor-pointer'>
                                    <ModeIcon className='text-2xl' />
                                </Card>
                            </button>
                        </TextTooltip>
                    </div>

                </div>
            </div>
        </div>
    )

}

export default Play
