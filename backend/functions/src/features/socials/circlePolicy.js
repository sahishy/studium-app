export const CIRCLE_LIMIT = 4
export const GRAND_QUEST_TARGET = 10
export const GRAND_QUEST_REWARD = { xp: 150, lumen: 100 }
export const canClaimGrandQuest = ({ primaryCircleId, circleId, eligible, member, claimed }) => primaryCircleId === circleId && eligible && member && !claimed
