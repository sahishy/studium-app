const CURVE_VERSION = 3
const TASK_DAILY_LIMIT = 5
const TASK_XP = 5
const MATCH_XP = 25
const MATCH_LUMEN = 10
const WIN_XP = 10
const WIN_LUMEN = 5
const CRATE_PRICE = 100
const DUPLICATE_REFUND = 50
const LEVEL_LUMEN_REWARD = 25
const MAX_LEVEL_XP = 600

// The curve flattens out so later levels stay reachable: a few ranked games or a
// day of quests should always be worth a visible slice of the bar.
const xpToNextLevel = (level) => Math.min(MAX_LEVEL_XP, 150 + 20 * (Math.max(1, Number(level) || 1) - 1))
const isCrateLevel = (level) => level === 2 || level === 5 || (level >= 10 && level % 5 === 0)
const earnedMilestoneCrates = (level) => {
    let count = 0
    for(let current = 2; current <= level; current += 1) if(isCrateLevel(current)) count += 1
    return count
}

// Every level past the first pays out something. Milestone levels give a crate,
// the levels between them give Lumen, and both are claimed by hand.
const levelReward = (level) => isCrateLevel(level)
    ? { level, type: 'crate', crates: 1, lumen: 0 }
    : { level, type: 'lumen', crates: 0, lumen: LEVEL_LUMEN_REWARD }

const claimableLevels = (level, claimed = []) => {
    const claimedSet = new Set((claimed || []).map((value) => Number(value)))
    const pending = []
    for(let current = 2; current <= level; current += 1) {
        if(!claimedSet.has(current)) pending.push(levelReward(current))
    }
    return pending
}

// Each curve change keeps a student's level and their proportional progress
// through it, so nobody loses a level when the maths underneath changes.
const previousThreshold = (curveVersion, level) => {
    if(curveVersion === 2) return 200 + 50 * (level - 1)
    return Math.pow(2, level) * 100
}

const normalizeProgress = (progress = {}) => {
    const level = Math.max(1, Math.floor(Number(progress.level) || 1))
    const oldXp = Math.max(0, Number(progress.xp) || 0)
    if(progress.curveVersion === CURVE_VERSION) return { ...progress, level, xp: oldXp }
    const oldThreshold = previousThreshold(Number(progress.curveVersion) || 1, level)
    return {
        ...progress,
        level,
        xp: Math.floor(Math.min(0.999999, oldXp / Math.max(1, oldThreshold)) * xpToNextLevel(level)),
        curveVersion: CURVE_VERSION,
    }
}

const grantXp = (progress, amount) => {
    const next = normalizeProgress(progress)
    let { level, xp } = next
    xp += Math.max(0, Math.floor(amount))
    while(xp >= xpToNextLevel(level)) {
        xp -= xpToNextLevel(level)
        level += 1
    }
    return { ...next, level, xp }
}

const localDayKey = (date, timeZone) => {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
    } catch {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
    }
}

const eligibleMatchReward = (result, userId) => {
    const validModes = new Set(['sat-classic', 'sat-timber', 'sat-puncture', 'sat-flutter'])
    const validEndReasons = new Set(['knockout', 'max_questions', 'first_to_three'])
    if(!result?.ranked || !validModes.has(result.modeId) || !validEndReasons.has(result.endReason) || Number(result.roundsPlayed) < 2 || Number(result.participationByUserId?.[userId]) < 2) {
        return { xp: 0, lumen: 0 }
    }
    const win = result.winnerUserId === userId
    return { xp: MATCH_XP + (win ? WIN_XP : 0), lumen: MATCH_LUMEN + (win ? WIN_LUMEN : 0) }
}

export {
    CRATE_PRICE, CURVE_VERSION, DUPLICATE_REFUND, LEVEL_LUMEN_REWARD, MAX_LEVEL_XP,
    TASK_DAILY_LIMIT, TASK_XP, claimableLevels, earnedMilestoneCrates, eligibleMatchReward,
    grantXp, isCrateLevel, levelReward, localDayKey, normalizeProgress, xpToNextLevel,
}
