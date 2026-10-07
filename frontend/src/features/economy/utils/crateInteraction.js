import { RARITY_ORDER } from './rarityUtils.js'

export const CRATE_CHANCES = 4
export const IMPACT_CLIPS = ['Hit_Left', 'Hit_Right', 'Hit_Back']
// Blender's export includes frame 1 as a short neutral lead-in.
export const CLIP_SECONDS = { Hit_Left: 24 / 24, Hit_Right: 22 / 24, Hit_Back: 26 / 24, Upgrade: 40 / 24, RevealBurst: 27 / 24 }
export const BURST_FLASH_SECONDS = 17 / 24
export const HIT_UPGRADE_CUE_SECONDS = 4 / 24
export const HIT_PLAYBACK_RATE = 1.65
export const UPGRADE_PLAYBACK_RATE = 1.35
export const canAcceptCrateTap = (phase, used) => ['waiting', 'impact', 'upgrading'].includes(phase) && used < CRATE_CHANCES
// Softer display-space colors match the bloom's appearance, not raw HDR emission.
export const RARITY_EFFECT_COLORS = {
    Common: '#c6cedb', Uncommon: '#77c991', Rare: '#7ea9e7',
    Epic: '#b99ae1', Legendary: '#e7be84',
}
export const getCrateProgressDots = (used) => Array.from({ length: CRATE_CHANCES }, (_, index) => index < used)

// Validate the server trace and support idempotent responses from older purchases.
export const getCrateRarityPath = (result) => {
    const finalRarity = RARITY_ORDER.includes(result?.color?.rarity) ? result.color.rarity : 'Common'
    const path = result?.rarityPath
    const valid = Array.isArray(path) && path.length === CRATE_CHANCES
        && path.at(-1) === finalRarity
        && path.every((rarity, index) => RARITY_ORDER.includes(rarity)
            && (index === 0 || RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf(path[index - 1])))
    return valid ? [...path] : ['Common', 'Common', 'Common', finalRarity]
}

export const chooseImpactClip = (previous, random = Math.random) => {
    const candidates = IMPACT_CLIPS.filter((clip) => clip !== previous)
    return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]
}
