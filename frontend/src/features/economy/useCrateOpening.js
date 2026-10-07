import { useCallback, useEffect, useRef, useState } from 'react'
import { useEconomy } from './EconomyContext'
import { useRewardFx } from './RewardFxContext'
import { BURST_FLASH_SECONDS, CLIP_SECONDS, CRATE_CHANCES, HIT_PLAYBACK_RATE, HIT_UPGRADE_CUE_SECONDS, UPGRADE_PLAYBACK_RATE, canAcceptCrateTap, chooseImpactClip, getCrateRarityPath } from './utils/crateInteraction'

// The server charges once and pre-rolls the reward. Four taps reveal its upgrade trace.
const useCrateOpening = (services = {}) => {
    const economy = useEconomy()
    const rewardFx = useRewardFx()
    const snapshot = services.snapshot ?? economy.snapshot
    const purchase = services.purchase ?? economy.openCrate
    const celebrateReward = services.celebrateReward ?? rewardFx.celebrateReward
    const [phase, setPhase] = useState('ready')
    const [result, setResult] = useState(null)
    const [rarity, setRarity] = useState('Common')
    const [rarityTransition, setRarityTransition] = useState(null)
    const [motion, setMotion] = useState(null)
    const [upgradeId, setUpgradeId] = useState(0)
    const [chancesUsed, setChancesUsed] = useState(0)
    const [assetReady, setAssetReady] = useState(false)
    const [error, setError] = useState('')
    const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    const mounted = useRef(true)
    const phaseRef = useRef('ready')
    const usedChances = useRef(0)
    const path = useRef([])
    const currentRarity = useRef('Common')
    const previousImpact = useRef(null)
    const pendingUpgrade = useRef(false)
    const motionId = useRef(0)
    const wallet = snapshot?.wallet
    const cratePrice = snapshot?.cratePrice ?? 100
    const hasToken = (wallet?.crateTokens ?? 0) > 0
    const canOpen = hasToken || (wallet?.balance ?? 0) >= cratePrice
    const markReady = useCallback(() => setAssetReady(true), [])
    const changePhase = useCallback((next) => { phaseRef.current = next; setPhase(next) }, [])

    useEffect(() => {
        mounted.current = true
        return () => { mounted.current = false }
    }, [])
    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)')
        const change = () => setReducedMotion(media.matches)
        media.addEventListener('change', change)
        return () => media.removeEventListener('change', change)
    }, [])

    useEffect(() => {
        let delay
        if(phase === 'impact' || phase === 'upgrading') {
            const duration = reducedMotion ? 120 : phase === 'impact' && pendingUpgrade.current
                ? HIT_UPGRADE_CUE_SECONDS * 1000
                : CLIP_SECONDS[motion.clip] * 1000 / (motion.timeScale ?? 1)
            delay = Math.max(0, duration - (performance.now() - motion.startedAt))
        } else if(phase === 'bursting' || phase === 'flashing') {
            const end = phase === 'bursting'
                ? (reducedMotion ? 180 : BURST_FLASH_SECONDS * 1000)
                : (reducedMotion ? 380 : CLIP_SECONDS.RevealBurst * 1000)
            delay = Math.max(0, end - (performance.now() - motion.startedAt))
        }
        else return undefined

        const timer = window.setTimeout(() => {
            // An interrupted motion must never overwrite a newer tap or start its old upgrade.
            if(!mounted.current || phaseRef.current !== phase || motion?.id !== motionId.current) return
            if(phase === 'impact') {
                if(pendingUpgrade.current) {
                    pendingUpgrade.current = false
                    setMotion({ clip: 'Upgrade', timeScale: UPGRADE_PLAYBACK_RATE, id: ++motionId.current, startedAt: performance.now() })
                    changePhase('upgrading')
                } else {
                    setMotion(null)
                    changePhase('waiting')
                }
            } else if(phase === 'upgrading') {
                setMotion(null)
                changePhase('waiting')
            } else if(phase === 'bursting') {
                changePhase('flashing')
            } else if(phase === 'flashing') {
                if(result?.refund) celebrateReward({ lumen: result.refund })
                changePhase('revealed')
            }
        }, delay)
        return () => window.clearTimeout(timer)
    }, [phase, motion, reducedMotion, result, celebrateReward, changePhase])

    const open = useCallback(async () => {
        if(phaseRef.current !== 'ready' || !canOpen || !assetReady) return
        changePhase('requesting')
        setError('')
        try {
            const reward = await purchase()
            if(!mounted.current) return
            path.current = getCrateRarityPath(reward)
            usedChances.current = 0
            setChancesUsed(0)
            currentRarity.current = 'Common'
            previousImpact.current = null
            pendingUpgrade.current = false
            setResult(reward)
            setRarity('Common')
            setRarityTransition(null)
            setMotion(null)
            setUpgradeId(0)
            changePhase('waiting')
        } catch(err) {
            if(!mounted.current) return
            setError(err.message)
            changePhase('ready')
        }
    }, [purchase, canOpen, assetReady, changePhase])

    const tap = useCallback(() => {
        if(!canAcceptCrateTap(phaseRef.current, usedChances.current)) return false
        // Count each click synchronously, including rapid taps, without ever accepting a fifth.
        const next = path.current[usedChances.current]
        pendingUpgrade.current = next !== currentRarity.current
        if(pendingUpgrade.current) {
            setRarityTransition({ from: currentRarity.current, to: next, startedAt: performance.now() })
            currentRarity.current = next
            setRarity(next)
            setUpgradeId((id) => id + 1)
        }
        usedChances.current++
        setChancesUsed(usedChances.current)
        if(usedChances.current === CRATE_CHANCES) {
            pendingUpgrade.current = false
            setMotion({ clip: 'RevealBurst', id: ++motionId.current, startedAt: performance.now() })
            changePhase('bursting')
            return true
        }
        const clip = chooseImpactClip(previousImpact.current)
        previousImpact.current = clip
        setMotion({ clip, timeScale: HIT_PLAYBACK_RATE, id: ++motionId.current, startedAt: performance.now() })
        changePhase('impact')
        return true
    }, [changePhase])

    // Restore the tab underneath the still-mounted reward's exit fade.
    const beginDismiss = useCallback(() => {
        if(phaseRef.current === 'flashing' || phaseRef.current === 'revealed') changePhase('closing')
    }, [changePhase])

    const dismiss = useCallback(() => {
        changePhase('ready')
        setResult(null)
        setMotion(null)
        setRarity('Common')
        setRarityTransition(null)
        setUpgradeId(0)
        usedChances.current = 0
        pendingUpgrade.current = false
        setChancesUsed(0)
    }, [changePhase])

    return { phase, result, rarity, rarityTransition, motion, upgradeId, chancesUsed, assetReady, markReady,
        reducedMotion, error, canOpen, hasToken, cratePrice, isBusy: phase !== 'ready',
        canTap: canAcceptCrateTap(phase, chancesUsed), showReward: ['flashing', 'revealed', 'closing'].includes(phase),
        isFlashing: phase === 'flashing', isRevealed: phase === 'revealed', open, tap, beginDismiss, dismiss }
}
export default useCrateOpening
