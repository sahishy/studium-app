import { useCallback, useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { request, post } from '../../../shared/services/apiService'
import { useMembers } from '../contexts/MembersContext'
import Button from '../../../shared/components/ui/Button'
import CircleQuestStage from '../components/CircleQuestStage'
import AvatarPicture from '../../../shared/components/avatar/AvatarPicture'
import Card from '../../../shared/components/ui/Card'
import LumenIcon from '../../economy/components/LumenIcon'
import TextTooltip from '../../../shared/components/tooltips/TextTooltip'
import { IoMdInformationCircleOutline } from 'react-icons/io'
import { PiStarFourFill } from 'react-icons/pi'
import { FaTrophy, FaClipboardCheck } from 'react-icons/fa6'
import { useEconomy } from '../../economy/EconomyContext'
import { useRewardFx } from '../../economy/RewardFxContext'
import { createGrandQuestClaimGuard } from '../utils/grandQuestClaimGuard'
const CircleActivityTab = () => {
    const { circleId, profile, circleMembers = [] } = useOutletContext()
    const members = useMembers()
    const [board, setBoard] = useState(null), [error, setError] = useState(''), [busy,setBusy] = useState(false)
    const [claimGuard] = useState(createGrandQuestClaimGuard)
    const loadSequence = useRef(0)
    const { refresh } = useEconomy(), { celebrateReward } = useRewardFx()
    const load = useCallback(async () => {
        const sequence = ++loadSequence.current
        try {
            const result = await request({ path: `/v1/circles/${circleId}/activity` })
            if (sequence !== loadSequence.current) return
            const key = JSON.stringify([profile.uid, circleId, result.claimCycle])
            if (result.claimCycle && claimGuard.hasClaimed(key)) return
            setBoard(result)
            setError('')
        } catch (err) { if (sequence === loadSequence.current) setError(err.message) }
    }, [circleId, profile.uid, claimGuard])
    useEffect(() => {setBoard(null);load(); const timer = setInterval(() => load(),30000); return () => clearInterval(timer)},[load,profile.primaryCircleId])
    const claim = async () => {
        const cycle = board?.claimCycle
        if (!board?.canClaim || !Number.isSafeInteger(cycle) || cycle < 1) return
        const key = JSON.stringify([profile.uid, circleId, cycle])
        if (!claimGuard.start(key)) return
        ++loadSequence.current
        setBusy(true)
        setError('')
        try {
            const result = await post(`/v1/circles/${circleId}/grand-quest/claim`, { cycle })
            claimGuard.markClaimed(key)
            setBoard(current => current?.claimCycle === cycle ? { ...current, canClaim: false, claimCycle: null, count: 0 } : current)
            if (!result.alreadyClaimed) celebrateReward(result.reward)
            await refresh()
            await load()
        } catch (err) { setError(err.message) }
        finally { claimGuard.finish(); setBusy(false) }
    }

    return <CircleActivityContent board={board} profile={profile} circleId={circleId} members={members} circleMembers={circleMembers}
        error={error} busy={busy} onClaim={claim} onRetry={load} />
}

export const CircleActivityContent = ({ board, profile, circleId, members, circleMembers, error = '', busy = false, onClaim, onRetry }) => {
    const complete = board?.count >= board?.target
    const isPrimary = profile.primaryCircleId === circleId
    const stageMembers = circleMembers
        .map(member => member.userId === profile.uid ? profile : members.find(user => user.uid === member.userId))
        .filter(Boolean)
        .sort((a, b) => Number(b.uid === profile.uid) - Number(a.uid === profile.uid) || a.uid.localeCompare(b.uid))
        .slice(0, 5)
    // Only rewarded tasks from this Circle belong in its activity feed.
    const events = (board?.events || []).filter(event => event.type !== 'task' || (event.circleId === circleId && event.xp > 0)).slice(0, 10)
    return <div className="w-full h-full min-h-0 max-w-6xl mx-auto flex flex-col pt-3">
        {error && <div role="alert" className="text-sm text-red-400 flex items-center gap-3 mb-4">{error}<Button onClick={onRetry}>Retry</Button></div>}
        {!board ? <p className="text-sm text-neutral1">Loading activity…</p> : <div className="flex-1 min-h-0 grid grid-cols-1 grid-rows-[minmax(0,1.4fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-1 gap-5 lg:gap-8">
            <section className="min-h-0 min-w-0 flex flex-col items-center text-center gap-1">
                <h2 className="shrink-0 mt-8 text-lg font-semibold">Grand Quest</h2>
                <p className="shrink-0 text-sm text-neutral1 max-w-xs">Complete quests together to fill up the orb!</p>
                <div className={`shrink-0 flex items-center justify-center gap-3 mt-3 text-sm font-semibold ${isPrimary ? "text-neutral0" : "text-neutral2"}`}>
                    <span role="img" aria-label={`${board.reward.xp} XP`} className={`flex items-center gap-1 ${isPrimary ? "text-yellow-400" : "text-neutral2"}`}><PiStarFourFill />{board.reward.xp}</span>
                    <span role="img" aria-label={`${board.reward.lumen} Lumen`} className={`flex items-center gap-1 ${isPrimary ? "text-sky-500" : "text-neutral2"}`}><LumenIcon className={`size-4 ${isPrimary ? "" : "grayscale opacity-50"}`} />{board.reward.lumen}</span>
                    {<TextTooltip placement="top" text={<span className="block max-w-60 leading-relaxed">To earn a Grand Quest reward, this circle must be your primary Circle.</span>}>
                        <button type="button" aria-label="Why Grand Quest rewards are unavailable" className="flex items-center justify-center text-neutral2 hover:text-neutral1">
                            <IoMdInformationCircleOutline className="text-lg" />
                        </button>
                    </TextTooltip>}
                </div>
                <CircleQuestStage count={board.count} target={board.target} members={stageMembers}
                    canClaim={board.canClaim} claiming={busy} onClaim={onClaim} />
                {!board.canClaim && isPrimary && complete && <p className="shrink-0 text-xs text-neutral1 mt-2 max-w-sm">Rewards require this Circle to have been your primary when the goal finished.</p>}
            </section>
            <section className="min-w-0 min-h-0 flex flex-col gap-3">
                <h2 className="shrink-0 text-lg font-semibold">Circle activity</h2>
                {!events.length && <div className="rounded-xl border border-dashed border-neutral4 p-6 flex flex-col items-center gap-3 text-center">
                    <FaClipboardCheck className="text-xl text-neutral2" />
                    <p className="text-sm text-neutral1">No activity yet</p>
                    <p className="text-xs text-neutral2">Completed quests and tasks will appear here.</p>
                </div>}
                <ol className="min-h-0 overflow-hidden flex flex-col gap-2 pb-4" style={{ maskImage: "linear-gradient(to bottom, black 0%, black 72%, transparent 100%)" }}>{events.map(event => {
                    const member = members.find(member => member.uid === event.userId)
                    const isGoal = event.type === 'goal'
                    const description = event.description || (event.type === 'quest' ? 'A daily quest' : 'A study task')
                    return <li key={event.id} className="shrink-0">
                        <Card className="flex-row! items-center p-3! gap-3! shadow-none!">
                            {isGoal ? <span className="size-9 shrink-0 flex items-center justify-center rounded-full bg-sky-400/10 text-sky-500"><FaTrophy /></span>
                                : <AvatarPicture profile={member} className="size-9!" />}
                            <div className="min-w-0 flex-1">
                                <p className="text-xs leading-5 truncate">{isGoal ? <span className="font-semibold">Grand Quest complete!</span> : <><span className="font-semibold">{member?.profile?.displayName || 'A member'}</span> {event.type === 'quest' ? 'completed a quest' : 'completed a task'}</>}</p>
                                <p className="text-xs text-neutral1 truncate" aria-description={isGoal ? 'You reached the goal together.' : description}>{isGoal ? 'You reached the goal together.' : description}</p>
                            </div>
                        </Card>
                    </li>
                })}</ol>
            </section>
        </div>}
    </div>
}
export default CircleActivityTab
