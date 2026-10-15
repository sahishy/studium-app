import { useEffect, useRef, useState } from 'react'
import { FaArrowRotateLeft, FaBoxOpen, FaCheck, FaClipboardCheck, FaXmark } from 'react-icons/fa6'
import { PiStarFourFill } from 'react-icons/pi'
import ProgressBar from '../../../shared/components/ui/ProgressBar'
import TextTooltip from '../../../shared/components/tooltips/TextTooltip'
import LoadingState from '../../../shared/components/ui/LoadingState'
import LumenIcon from '../../economy/components/LumenIcon'
import { getRarityGradient, getRarityStyle, RARITY_ORDER } from '../../economy/utils/rarityUtils'
import { useQuests } from '../QuestContext'
import { QUEST_GROUP_ICONS, QUEST_CARD_TILTS } from '../utils/questPresentation.jsx'
import './questAnimations.css'

const REVEAL_MS = [750, 1050, 1450, 1950, 2550]

const QuestCard = ({ quest, index = 0, rerolling = false, pending = false, picked = false, onPick }) => {
    const token = quest.instanceId ?? quest.id
    const previousToken = useRef(token)
    const timers = useRef([])
    const chargeStartedAt = useRef(null)
    const [phase, setPhase] = useState('idle')
    const [shownQuest, setShownQuest] = useState(quest)
    const tier = Math.max(0, RARITY_ORDER.indexOf(quest.rarity))
    const duration = REVEAL_MS[tier]
    // The claim round-trip is long enough to read as a stall, so the collapse starts on the click
    // rather than when the replacement lands. Every replacement still gets its full rarity buildup.
    useEffect(() => {
        if(!picked || phase !== 'idle') return
        chargeStartedAt.current = Date.now()
        setPhase('collapse')
        timers.current.push(setTimeout(() => setPhase('charge'), 180))
    }, [picked, phase])
    useEffect(() => {
        if(previousToken.current === token) {
            setShownQuest(quest)
            return
        }
        previousToken.current = token
        timers.current.forEach(clearTimeout)
        const startedAt = chargeStartedAt.current
        chargeStartedAt.current = null
        // Credit only the collapse, never the rarity buildup: network latency must not
        // consume the animation. A fast response still schedules the placeholder phase.
        const chargeAt = startedAt == null ? 180 : Math.max(0, 180 - (Date.now() - startedAt))
        const revealAt = chargeAt + duration
        timers.current = []
        if(chargeAt > 0) {
            setPhase('collapse')
            timers.current.push(setTimeout(() => setPhase('charge'), chargeAt))
        } else {
            setPhase('charge')
        }
        timers.current.push(
            setTimeout(() => { setShownQuest(quest); setPhase('reveal') }, revealAt),
            setTimeout(() => setPhase('idle'), revealAt + 650),
        )
    }, [token, duration, quest])
    useEffect(() => {
        // A rejected claim or reroll keeps the same token. Restore its card rather
        // than leaving it stuck as a disabled placeholder.
        if(picked || pending || chargeStartedAt.current == null || previousToken.current !== token) return
        timers.current.forEach(clearTimeout)
        timers.current = []
        chargeStartedAt.current = null
        setShownQuest(quest)
        setPhase('idle')
    }, [picked, pending, token, quest])
    useEffect(() => () => timers.current.forEach(clearTimeout), [])
    // The board swaps in the replacement quest the instant a claim lands, but the effect that
    // starts the reveal only runs after React has painted - so for one frame the card would show
    // the new quest outright, spoiling what the animation is about to reveal. Comparing the token
    // during render keeps the old face up until the collapse takes over.
    const swapping = previousToken.current !== token
    const face = swapping || phase === 'collapse' ? shownQuest : quest
    const rarity = getRarityStyle(face.rarity)
    const tilt = QUEST_CARD_TILTS[index % QUEST_CARD_TILTS.length]
    const selectable = rerolling && !quest.completed
    const claimable = quest.completed && !rerolling
    const charging = phase === 'charge'
    return (
        <div className={`quest-slot relative flex-1 min-w-0 ${phase === 'idle' && !swapping ? 'quest-idle animate-quest-float' : ''}`}
            style={{ '--quest-tilt': `${tilt.rotate}deg`, '--quest-delay': `${tilt.delay}ms`, '--quest-color': rarity.color,
                '--quest-duration': `${duration}ms`, '--quest-wiggle': `${2 + tier * 2}deg`, '--quest-shrink': 0.7 - tier * 0.08 }}>
            <button key={charging ? `charge:${token}` : 'face'} type='button' disabled={pending || swapping || phase !== 'idle' || (!selectable && !claimable)}
                onClick={() => onPick(quest)}
                aria-label={charging ? 'Revealing your next quest' : selectable ? `Reroll quest: ${quest.label}` : claimable ? `Claim rewards: ${quest.label}` : quest.label}
                className={`quest-card relative flex min-h-52 h-full w-full flex-col items-center gap-3 rounded-xl border p-4 text-left bg-neutral6 dark:bg-neutral5 shadow-lg shadow-shadow transition-colors
                    ${phase === 'collapse' ? 'quest-collapse border-neutral4' : charging ? 'quest-charge border-neutral4' : phase === 'reveal' ? 'quest-reveal ' + rarity.ring : claimable ? `quest-ready cursor-pointer ${rarity.ring}` : selectable ? 'border-red-400 cursor-pointer' : 'border-neutral4'}
                    ${rerolling && quest.completed ? 'opacity-50' : ''}`}>
                {charging ? <div aria-hidden='true' className='flex flex-1 w-full flex-col items-center gap-4 py-1'>
                    <span className='size-10 rounded-xl bg-neutral4/70' />
                    <span className='h-2 w-4/5 rounded bg-neutral4/70' />
                    <span className='h-2 w-3/5 rounded bg-neutral4/50' />
                    <span className='mt-auto h-2 w-1/2 rounded bg-neutral4/50' />
                    <span className='h-1.5 w-full rounded bg-neutral4/50' />
                </div> : <>
                    <div className='pointer-events-none absolute inset-0 rounded-xl' style={{ background: getRarityGradient(face.rarity) }} />
                    {phase === 'reveal' && <span aria-hidden='true' className='quest-burst absolute inset-0 rounded-xl' />}
                    <div className={`relative flex size-10 shrink-0 items-center justify-center rounded-xl text-sm ${rarity.tint} ${rarity.text}`}>
                        {face.completed ? <FaCheck /> : QUEST_GROUP_ICONS[face.group]}
                    </div>
                    <p className='relative flex flex-1 items-center justify-center text-center text-xs font-semibold leading-snug text-neutral0'>{face.label}</p>
                    <div className='relative flex flex-wrap items-center justify-center gap-2 text-[0.7rem] font-semibold'>
                        <span className='flex items-center gap-1 text-yellow-400'><PiStarFourFill /> {face.xp}</span>
                        <span className='flex items-center gap-1 text-sky-500'><LumenIcon className='size-3' /> {face.lumen}</span>
                        {face.crates > 0 && <span className='flex items-center gap-1 text-neutral1'><FaBoxOpen /> {face.crates}</span>}
                    </div>
                    <ProgressBar value={face.current} max={face.target} className='relative h-1.5 w-full'
                        fillStyle={{ backgroundColor: rarity.color }} />
                </>}
            </button>
        </div>
    )
}

const QuestBoard = ({ className = '' }) => {
    const { quests, loading, rerollsRemaining, rerollsTotal, rerollQuest, claimQuest } = useQuests()
    const [rerolling, setRerolling] = useState(false)
    const [pending, setPending] = useState(false)
    const picking = useRef(false)
    const [pickedId, setPickedId] = useState(null)
    const [error, setError] = useState('')
    const canReroll = rerollsRemaining > 0 && quests.some((quest) => !quest.completed)
    const pick = async (quest) => {
        if(picking.current) return
        picking.current = true
        setPickedId(quest.id)
        setPending(true)
        setError('')
        try {
            if(quest.completed && !rerolling) await claimQuest(quest)
            else await rerollQuest(quest.id)
            setRerolling(false)
        } catch(err) {
            setError(err.message || 'Could not update that quest. Try again.')
        } finally {
            picking.current = false
            setPickedId(null)
            setPending(false)
        }
    }
    if(loading) return <LoadingState className={className} />

    return <div className={`flex flex-col gap-3 ${className}`}>
        <div className='relative flex min-h-6 items-center justify-end px-1'>
            <h2 className='absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-sm font-semibold text-neutral0'>Quests <FaClipboardCheck className='text-sm text-neutral1' /></h2>
            <TextTooltip text={rerolling ? 'Cancel' : canReroll ? 'Reroll a quest' : 'No rerolls left today'}>
                <button type='button' disabled={pending || (!rerolling && !canReroll)} onClick={() => { setError(''); setRerolling((value) => !value) }}
                    aria-label={rerolling ? 'Cancel rerolling' : 'Reroll a quest'}
                    className={`flex items-center gap-1.5 text-[0.7rem] font-semibold tabular-nums transition disabled:opacity-40 ${rerolling ? 'text-red-400' : 'text-neutral1 hover:text-neutral0'}`}>
                    {rerolling ? <FaXmark /> : <FaArrowRotateLeft />} <span>{rerollsRemaining}/{rerollsTotal}</span>
                </button>
            </TextTooltip>
        </div>
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-5 px-1 py-2'>
            {quests.map((quest, index) => <QuestCard key={index} quest={quest} index={index} rerolling={rerolling} pending={pending} picked={pickedId === quest.id} onPick={pick} />)}
        </div>
        {rerolling && <p className='text-center text-[0.7rem] font-semibold text-red-400'>Pick a quest to reroll.</p>}
        {error && <p role='alert' className='text-center text-xs text-red-400'>{error}</p>}
    </div>
}
export default QuestBoard
