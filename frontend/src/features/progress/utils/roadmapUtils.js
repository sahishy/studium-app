import { isCrateLevel } from '../../profile/utils/xpUtils'

const LEVELS_AHEAD = 12
const LEVELS_BEHIND = 6
const WAVE_AMPLITUDE = 148
const WAVE_FREQUENCY = 0.62

const levelRewardType = (level) => (isCrateLevel(level) ? 'crate' : 'lumen')

// Keyed to the level itself rather than a position in the window, so a node
// keeps the same place on the path no matter how far the window has slid.
const waveOffsetFor = (level) => Math.sin((level - 1) * WAVE_FREQUENCY) * WAVE_AMPLITUDE

// Builds the stretch of the roadmap worth drawing: far enough back to show what
// is still unclaimed, far enough ahead to show what is coming.
const buildRoadmap = ({ level = 1, claimedLevels = [] }) => {

    const claimed = new Set((claimedLevels || []).map(Number))
    const lowestUnclaimed = [...Array(Math.max(0, level - 1))].reduce((lowest, _, index) => {
        const candidate = index + 2
        return lowest == null && !claimed.has(candidate) ? candidate : lowest
    }, null)

    // Level 1 is always on the path even though it pays nothing: it is where a
    // new student's character stands, so the roadmap is never empty beneath them.
    const start = Math.max(1, Math.min(lowestUnclaimed ?? level, level - LEVELS_BEHIND))
    const end = level + LEVELS_AHEAD

    return [...Array(end - start + 1)].map((_, index) => {

        const nodeLevel = start + index
        const reward = nodeLevel === 1 ? 'start' : levelRewardType(nodeLevel)
        const reached = nodeLevel <= level
        const isClaimed = claimed.has(nodeLevel)

        return {
            level: nodeLevel,
            reward,
            state: reward === 'start' ? 'claimed' : !reached ? 'locked' : isClaimed ? 'claimed' : 'claimable',
            offset: waveOffsetFor(nodeLevel),
        }
    })
}

export { LEVELS_AHEAD, LEVELS_BEHIND, buildRoadmap, levelRewardType, waveOffsetFor }
