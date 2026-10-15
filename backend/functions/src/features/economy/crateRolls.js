export const CRATE_CHANCES = 4
export const CRATE_RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']

// Decide the final rarity at purchase using the published odds. Taps only
// reveal it: distribute its single-tier upgrades across the four chances.
export const rollCrateRarityPath = (odds, random) => {
    const total = CRATE_RARITIES.reduce((sum, rarity) => sum + (odds[rarity] || 0), 0)
    if(total <= 0) throw new Error('Crate rarity odds must have positive weight.')
    let cumulative = 0
    const thresholds = CRATE_RARITIES.map((rarity) => {
        cumulative += odds[rarity] || 0
        return cumulative / total
    })
    const roll = random()
    const selected = thresholds.findIndex((threshold) => roll < threshold)
    const finalTier = selected < 0 ? CRATE_RARITIES.length - 1 : selected
    let current = 0
    return Array.from({ length: CRATE_CHANCES }, (_, index) => {
        const remaining = CRATE_CHANCES - index
        const upgrades = finalTier - current
        if(upgrades > 0 && (upgrades === remaining || random() < upgrades / remaining)) current++
        return CRATE_RARITIES[current]
    })
}
