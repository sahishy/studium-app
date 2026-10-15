import { createHash } from 'node:crypto'
export const CIRCLE_LIMIT = 4
export const GRAND_QUEST_VERSION = 2
// Stable random draws prevent refreshes and transaction retries from rerolling a goal.
export const grandQuestRound = (circleId, cycle) => {
    const draw = createHash('sha256').update(`grand-quest-v2:${circleId}:${cycle}`).digest()
    const target = 50 + draw.readUInt32BE(0) % 51
    const difficulty = target - 50
    const xp = Math.max(150, Math.min(400, 150 + difficulty * 5 + draw[4] % 41 - 20))
    const lumen = Math.max(100, Math.min(300, 100 + difficulty * 4 + draw[5] % 31 - 15))
    return { target, reward: { xp, lumen } }
}
export const grandQuestState = (circleId, saved = {}) => {
    if (saved.version === GRAND_QUEST_VERSION) return { ...saved }
    const count = Math.max(0, Number(saved.count) || 0)
    const cycle = Math.floor(count / 10) + 1
    return { count, cycle, roundProgress: count % 10, ...grandQuestRound(circleId, cycle), version: GRAND_QUEST_VERSION }
}
export const eligibleGrandQuestRound = (round, uid) => round.version === GRAND_QUEST_VERSION && Boolean(round.eligible?.includes(uid))
export const canClaimGrandQuest = ({ primaryCircleId, circleId, eligible, member, claimed }) => primaryCircleId === circleId && eligible && member && !claimed
