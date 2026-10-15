const MAX_LEVEL_XP = 600

// Mirrors the server curve in backend/functions/src/features/economy/progression.js.
const getXpToNextLevel = ( level ) => {
    return Math.min(MAX_LEVEL_XP, 150 + 20 * (Math.max(1, Number(level) || 1) - 1))
}

const isCrateLevel = ( level ) => level === 2 || level === 5 || (level >= 10 && level % 5 === 0)

export {
    MAX_LEVEL_XP,
    getXpToNextLevel,
    isCrateLevel,
}
