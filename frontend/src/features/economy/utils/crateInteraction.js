import { RARITY_ORDER } from './rarityUtils.js'

export const CRATE_CHANCES = 4
export const IMPACT_CLIPS = ['Hit_Left', 'Hit_Right', 'Hit_Back']
// Blender's export includes frame 1 as a short neutral lead-in.
export const CLIP_SECONDS = { Hit_Left: 24 / 24, Hit_Right: 22 / 24, Hit_Back: 26 / 24, Upgrade: 40 / 24, RevealBurst: 27 / 24 }
export const BURST_FLASH_SECONDS = 17 / 24
export const BURST_PLAYBACK_RATES = { Common: 1, Uncommon: 0.95, Rare: 0.85, Epic: 0.7, Legendary: 0.55 }
export const getCrateBurstTiming = (rarity) => {
    const timeScale = BURST_PLAYBACK_RATES[rarity] ?? 1
    return {
        timeScale,
        flashSeconds: BURST_FLASH_SECONDS / timeScale,
        endSeconds: CLIP_SECONDS.RevealBurst / timeScale,
    }
}
export const HIT_UPGRADE_CUE_SECONDS = 4 / 24
export const HIT_PLAYBACK_RATE = 1.65
export const UPGRADE_PLAYBACK_RATE = 1.35
export const canAcceptCrateTap = (phase, used) => phase === 'awaitingOpen'
    ? used === CRATE_CHANCES
    : ['waiting', 'impact', 'upgrading'].includes(phase) && used < CRATE_CHANCES
// Softer display-space colors match the bloom's appearance, not raw HDR emission.
export const RARITY_EFFECT_COLORS = {
    Common: '#c6cedb', Uncommon: '#77c991', Rare: '#7ea9e7',
    Epic: '#b99ae1', Legendary: '#e7be84',
}
export const getCrateProgressDots = (used) => Array.from({ length: CRATE_CHANCES }, (_, index) => index < used)
export const CRATE_RARITY_SHINES = {
    Rare: { opacity: 0.07, size: 840 },
    Epic: { opacity: 0.13, size: 1120 },
    Legendary: { opacity: 0.22, size: 1400 },
}

// Uniformly choose which chance slots contain the required one-tier upgrades.
// This changes presentation only, never the already-granted reward.
export const createCrateRevealPath = (rarity, random = Math.random, chances = CRATE_CHANCES) => {
    const finalTier = Math.max(0, RARITY_ORDER.indexOf(rarity))
    if(!Number.isInteger(chances) || chances < finalTier || chances < 1) throw new Error('Not enough chances to reveal this rarity.')
    let current = 0
    return Array.from({ length: chances }, (_, index) => {
        const remaining = chances - index
        const upgrades = finalTier - current
        if(upgrades > 0 && (upgrades === remaining || random() < upgrades / remaining)) current++
        return RARITY_ORDER[current]
    })
}

// Validate the server trace and support idempotent responses from older purchases.
export const getCrateRarityPath = (result, random = Math.random) => {
    const finalRarity = RARITY_ORDER.includes(result?.color?.rarity) ? result.color.rarity : 'Common'
    const path = result?.rarityPath
    const valid = Array.isArray(path) && path.length === CRATE_CHANCES
        && path.at(-1) === finalRarity
        && path.every((rarity, index) => {
            const before = index === 0 ? 0 : RARITY_ORDER.indexOf(path[index - 1])
            const change = RARITY_ORDER.indexOf(rarity) - before
            return RARITY_ORDER.includes(rarity) && (change === 0 || change === 1)
        })
    // Older server responses may skip tiers. Reveal the granted rarity safely
    // without another reward roll, and never change the actual item.
    return valid ? [...path] : createCrateRevealPath(finalRarity, random)
}

export const chooseImpactClip = (previous, random = Math.random) => {
    const candidates = IMPACT_CLIPS.filter((clip) => clip !== previous)
    return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]
}
