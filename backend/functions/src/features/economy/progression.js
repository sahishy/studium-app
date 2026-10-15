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

// Reward shaping. The multiplier band is deliberately wide enough that a strong loss can out-earn
// a weak win: answering questions well is the behaviour worth paying for, and a match where you
// learned something should never feel like wasted time because the scoreboard went the other way.
const PERFORMANCE_MIN_MULTIPLIER = 0.6
const PERFORMANCE_MULTIPLIER_RANGE = 0.8
const ACCURACY_WEIGHT = 0.55
const ROUND_SHARE_WEIGHT = 0.25
const SPEED_WEIGHT = 0.2
// Answering at or under the target earns full speed credit; at or over the floor, none. The band
// is generous because a hard question deserves thinking time - speed is a nudge, not the point.
const SPEED_TARGET_MS = 25_000
const SPEED_FLOOR_MS = 90_000
const UNDERDOG_ELO_SPAN = 300
const UNDERDOG_MAX_BONUS = 0.4
// Full value for a normal session, then tapering, so the ladder stays open to someone with time
// to spend without making all-day grinding the most efficient way to earn.
const DIMINISHING_FULL_MATCHES = 8
const DIMINISHING_HALF_MATCHES = 16

const VALID_REWARD_MODES = new Set(['sat-classic', 'sat-timber', 'sat-puncture', 'sat-flutter'])
const VALID_REWARD_END_REASONS = new Set(['knockout', 'max_questions', 'first_to_three'])

const clamp01 = (value) => Math.min(1, Math.max(0, value))

const speedScore = (avgAnswerMs) => {
    const ms = Number(avgAnswerMs)
    // No timing sample is scored neutral rather than slow, so a mode or match that never reported
    // one cannot quietly dock a student's reward.
    if(!Number.isFinite(ms) || ms < 0) return 0.5
    if(ms <= SPEED_TARGET_MS) return 1
    if(ms >= SPEED_FLOOR_MS) return 0
    return 1 - ((ms - SPEED_TARGET_MS) / (SPEED_FLOOR_MS - SPEED_TARGET_MS))
}

// 0..1, or null when the match carried no question telemetry at all - an older match, or one
// recorded before telemetry shipped. Callers treat null as "pay the flat rate".
const performanceScore = ({ performance, roundsPlayed } = {}) => {
    const faced = Math.max(0, Number(performance?.faced) || 0)
    const answered = Math.max(0, Number(performance?.answered) || 0)

    if(!faced && !answered) return null

    const correct = Math.max(0, Number(performance?.correct) || 0)
    const roundsWon = Math.max(0, Number(performance?.roundsWon) || 0)
    const rounds = Math.max(0, Number(roundsPlayed) || 0)

    // Accuracy is measured against questions faced, not questions answered, so letting the clock
    // run out on everything you do not know cannot be used to farm a perfect ratio.
    const accuracy = faced ? clamp01(correct / faced) : clamp01(correct / Math.max(1, answered))
    const roundShare = rounds ? clamp01(roundsWon / rounds) : 0.5

    return clamp01(
        (accuracy * ACCURACY_WEIGHT)
        + (roundShare * ROUND_SHARE_WEIGHT)
        + (speedScore(performance?.avgAnswerMs) * SPEED_WEIGHT),
    )
}

const diminishingFactor = (priorRewardedMatchesToday) => {
    const played = Math.max(0, Math.floor(Number(priorRewardedMatchesToday) || 0))
    if(played < DIMINISHING_FULL_MATCHES) return 1
    if(played < DIMINISHING_HALF_MATCHES) return 0.5
    return 0.25
}

const isRewardEligible = (result, userId) => Boolean(
    result?.ranked
    && VALID_REWARD_MODES.has(result.modeId)
    && VALID_REWARD_END_REASONS.has(result.endReason)
    && Number(result.roundsPlayed) >= 2
    && Number(result.participationByUserId?.[userId]) >= 2,
)

const eligibleMatchReward = (result, userId, {
    performance = null,
    selfElo = 0,
    opponentElo = 0,
    priorRewardedMatchesToday = 0,
} = {}) => {
    if(!isRewardEligible(result, userId)) return { xp: 0, lumen: 0 }

    const win = result.winnerUserId === userId
    const score = performanceScore({ performance, roundsPlayed: result.roundsPlayed })
    const multiplier = score == null
        ? 1
        : PERFORMANCE_MIN_MULTIPLIER + (PERFORMANCE_MULTIPLIER_RANGE * score)

    // Beating someone rated above you pays more; losing to them costs nothing extra.
    const underdog = win
        ? clamp01((Number(opponentElo) - Number(selfElo)) / UNDERDOG_ELO_SPAN)
        : 0
    const winFactor = win ? 1 + (UNDERDOG_MAX_BONUS * underdog) : 0
    const grind = diminishingFactor(priorRewardedMatchesToday)

    // Performance scales the win bonus as well as the base, not just the base. Applied only to
    // the base, a flat win bonus worth 40% of it drowns out the entire performance band - a 2/10
    // win and a 9/10 loss came out to the same number, which defeats the point of measuring.
    // An eligible match never pays nothing: downstream code reads a non-zero xp as "this match
    // counted", and it gates both the rankedMatches badge counter and play quest progress.
    return {
        xp: Math.max(1, Math.round((MATCH_XP + (WIN_XP * winFactor)) * multiplier * grind)),
        lumen: Math.max(1, Math.round((MATCH_LUMEN + (WIN_LUMEN * winFactor)) * multiplier * grind)),
    }
}

export {
    CRATE_PRICE, CURVE_VERSION, DIMINISHING_FULL_MATCHES, DIMINISHING_HALF_MATCHES,
    DUPLICATE_REFUND, LEVEL_LUMEN_REWARD, MAX_LEVEL_XP, TASK_DAILY_LIMIT, TASK_XP,
    claimableLevels, diminishingFactor, earnedMilestoneCrates, eligibleMatchReward, grantXp,
    isCrateLevel, isRewardEligible, levelReward, localDayKey, normalizeProgress,
    performanceScore, speedScore, xpToNextLevel,
}
