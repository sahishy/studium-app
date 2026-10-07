export const CRATE_CHANCES = 4
export const CRATE_RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']

// Four independent upgrade opportunities with the same published FINAL odds.
// P(max of four draws <= tier) = P(one draw <= tier)^4.
export const rollCrateRarityPath = (odds, random) => {
    const total = CRATE_RARITIES.reduce((sum, rarity) => sum + (odds[rarity] || 0), 0)
    if(total <= 0) throw new Error('Crate rarity odds must have positive weight.')
    let cumulative = 0
    const thresholds = CRATE_RARITIES.map((rarity) => {
        cumulative += odds[rarity] || 0
        return (cumulative / total) ** (1 / CRATE_CHANCES)
    })
    let current = 0
    return Array.from({ length: CRATE_CHANCES }, () => {
        const roll = random()
        const tier = thresholds.findIndex((threshold) => roll < threshold)
        current = Math.max(current, tier < 0 ? CRATE_RARITIES.length - 1 : tier)
        return CRATE_RARITIES[current]
    })
}
