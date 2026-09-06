import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { FaTrophy } from 'react-icons/fa6'
import Topbar from '../../../shared/components/ui/Topbar'
import PageHeader from '../../../shared/components/ui/PageHeader'
import Card from '../../../shared/components/ui/Card'
import Button from '../../../shared/components/ui/Button'
import LoadingState from '../../../shared/components/ui/LoadingState'
import IconTabSelector from '../../../shared/components/ui/IconTabSelector'
import AvatarPicture from '../../../shared/components/avatar/AvatarPicture'
import { getUsersByIds } from '../../auth/services/userService'
import { GAME_MODES } from '../../multiplayer/utils/multiplayerUtils'
import { getRankInfoFromElo } from '../../profile/utils/statsUtils'
import { PlayerSpot } from '../../multiplayer/components/PartyStage'
import { getLeaderboardPage } from '../services/leaderboardService'

const PAGE_SIZE = 50

const TABS = [
    { name: 'total', label: 'Total', icon: <FaTrophy /> },
    ...GAME_MODES.filter((mode) => mode.ranked).map((mode) => {
        const ModeIcon = mode.icon
        return { name: mode.id, label: mode.name, icon: <ModeIcon /> }
    }),
]

const PODIUM_SLOTS = [
    { rank: 3, className: 'relative z-10 translate-x-20' },
    { rank: 1, className: 'relative z-20 -translate-y-12' },
    { rank: 2, className: 'relative z-10 -translate-x-12 -translate-y-6' },
]

const PODIUM_CARD_CLASSES = [
    'bg-amber-400/5! border-amber-400/25!',
    'bg-slate-300/5! border-slate-300/25!',
    'bg-orange-700/5! border-orange-700/25!',
]

const getEloForLeaderboard = (entry, leaderboardId) => {
    if (leaderboardId === 'total') return Number(entry?.totalElo) || 0
    return Number(entry?.play?.[leaderboardId]?.elo) || 0
}

// Podium avatars each own a WebGL context (via AvatarModel's Canvas), and some ranks mount/unmount
// entirely when a leaderboard has no entries for that slot. Clicking through tabs rapidly can queue
// up WebGL context creation/teardown faster than the GPU process can keep up, which crashes a
// context (shows as a broken-image placeholder) until the page reloads. Debouncing which tab
// actually drives data/podium rendering — while keeping the tab highlight itself instant — means a
// flurry of clicks only causes one remount once the user settles on a tab, not one per click.
const TAB_SWITCH_DEBOUNCE_MS = 200

const Leaderboards = () => {
    const { profile } = useOutletContext()

    const [selectedTab, setSelectedTab] = useState('total')
    const [leaderboardId, setLeaderboardId] = useState('total')
    const [entries, setEntries] = useState([])
    const [cursor, setCursor] = useState(null)
    const [hasMore, setHasMore] = useState(false)
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [usersByUid, setUsersByUid] = useState({})

    const currentTabIndex = Math.max(0, TABS.findIndex((tab) => tab.name === selectedTab))

    useEffect(() => {
        const timeout = setTimeout(() => setLeaderboardId(selectedTab), TAB_SWITCH_DEBOUNCE_MS)
        return () => clearTimeout(timeout)
    }, [selectedTab])

    useEffect(() => {
        let isCancelled = false

        const loadFirstPage = async () => {
            setLoading(true)
            try {
                const result = await getLeaderboardPage(leaderboardId, { limitCount: PAGE_SIZE, cursor: null })
                if (isCancelled) return
                setEntries(result.entries)
                setCursor(result.nextCursor)
                setHasMore(result.hasMore)
            } finally {
                if (!isCancelled) setLoading(false)
            }
        }

        loadFirstPage()

        return () => { isCancelled = true }
    }, [leaderboardId])

    useEffect(() => {
        const userIds = entries.map((entry) => entry.uid)
        if (userIds.length === 0) {
            setUsersByUid({})
            return () => { }
        }
        return getUsersByIds(userIds, (users) => {
            setUsersByUid(Object.fromEntries(users.map((user) => [user.uid, user])))
        })
    }, [entries])

    const handleLoadMore = async () => {
        if (loadingMore || !hasMore) return
        setLoadingMore(true)
        try {
            const result = await getLeaderboardPage(leaderboardId, { limitCount: PAGE_SIZE, cursor })
            setEntries((previous) => [...previous, ...result.entries])
            setCursor(result.nextCursor)
            setHasMore(result.hasMore)
        } finally {
            setLoadingMore(false)
        }
    }

    const topThree = useMemo(() => entries.slice(0, 3), [entries])

    return (
        <div className='flex flex-col h-full overflow-hidden'>
            <Topbar profile={profile} />

            <div className='w-full flex-1 flex flex-col gap-4 px-24 pb-0 pt-2 min-h-0'>

                <div className='flex justify-between items-start w-full'>
                    <PageHeader text='Leaderboards' icon={FaTrophy} />

                    <IconTabSelector
                        tabs={TABS}
                        currentIndex={currentTabIndex}
                        onSelect={(tab) => setSelectedTab(tab.name)}
                    />
                </div>

                <div className='flex-1 flex gap-5 xl:gap-7 items-stretch min-h-0 overflow-visible'>

                    <div className='relative flex-1 min-w-0 min-h-0 flex items-end justify-center px-1 pb-12 overflow-visible'>
                        <div className='relative z-10 w-full grid grid-cols-[minmax(9rem,1fr)_minmax(16rem,1.25fr)_minmax(9rem,1fr)] items-end'>
                            {PODIUM_SLOTS.map((slot) => {
                                const entry = topThree[slot.rank - 1]
                                const podiumProfile = entry ? (usersByUid[entry.uid] ?? null) : null

                                const member = {
                                    userId: entry?.uid ?? `empty-podium-${slot.rank}`,
                                    displayName: podiumProfile?.profile?.displayName ?? 'Unknown user',
                                    profilePicture: podiumProfile?.profile?.profilePicture ?? null,
                                    avatar: podiumProfile?.profile?.avatar ?? null,
                                    ready: false,
                                }

                                return (
                                    <PlayerSpot
                                        key={slot.rank}
                                        member={member}
                                        currentProfile={podiumProfile}
                                        focus={slot.rank === 1}
                                        showLabel={false}
                                        showAvatar={Boolean(podiumProfile)}
                                        showPodiumShadow={slot.rank === 1}
                                        className={slot.className}
                                    />
                                )
                            })}
                        </div>
                    </div>

                    <div className='w-full max-w-[22rem] flex flex-col gap-4 min-w-0 min-h-0 overflow-y-auto pb-8'>
                        {loading ? (
                            <LoadingState />
                        ) : entries.length === 0 ? (
                            <div className='flex-1 flex flex-col gap-1 items-center justify-center py-16'>
                                <h1 className='text-xl font-bold'>No rankings yet</h1>
                                <p className='text-sm text-neutral1'>Play a ranked match to appear on this leaderboard.</p>
                            </div>
                        ) : (
                            <div className='flex flex-col gap-2'>
                                {entries.map((entry, index) => {
                                    const entryProfile = usersByUid[entry.uid] ?? null
                                    const isSelf = profile?.uid && entry.uid === profile.uid
                                    const entryElo = getEloForLeaderboard(entry, leaderboardId)
                                    const entryRankIcon = getRankInfoFromElo(entryElo)
                                    return (
                                        <div className='flex items-center'>
                                            <span className='text-sm font-semibold text-neutral2 w-8 shrink-0'>#{index + 1}</span>
                                            <Card
                                                key={entry.uid}
                                                className={`flex-1 flex-row items-center gap-3 py-2 px-4 ${PODIUM_CARD_CLASSES[index] ?? (isSelf ? 'border-neutral2' : '')}`}
                                            >
                                                <AvatarPicture profile={entryProfile} className='w-10 h-10' />
                                                <span className='text-sm font-semibold text-neutral0 truncate flex-1'>
                                                    {entryProfile?.profile?.displayName ?? 'Unknown user'}
                                                </span>
                                                <div className='flex items-center gap-1 shrink-0'>
                                                    <div className='relative flex items-center justify-center w-4 h-4'>
                                                        <img
                                                            src={entryRankIcon.imageSrc}
                                                            alt={`${entryRankIcon.tierName} rank icon`}
                                                            className='absolute w-6 h-6 object-cover'
                                                        />
                                                    </div>
                                                    <span className='text-sm font-semibold text-neutral0'>
                                                        {entryElo}
                                                        <span className='ml-1 text-[10px] text-neutral1 font-medium'>SAT</span>
                                                    </span>
                                                </div>
                                            </Card>
                                        </div>

                                    )
                                })}

                                {hasMore && (
                                    <div className='w-full flex justify-center pt-4'>
                                        <Button type='secondary' onClick={handleLoadMore} disabled={loadingMore}>
                                            {loadingMore ? 'Loading...' : 'Load More'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    )
}

export default Leaderboards
