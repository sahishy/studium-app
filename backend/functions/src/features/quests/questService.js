import { readCircleContexts, contributeQuests } from '../socials/circleGoals.js'
import { randomInt } from 'node:crypto'
import { db } from '../../lib/firebaseAdmin.js'
import { readAccount, writeAccount } from '../economy/economyService.js'
import { localDayKey } from '../economy/progression.js'

const DAILY_QUEST_COUNT = 3
const DAILY_REROLLS = 1

// Difficulty and payout both ride on rarity, so balancing is a single table rather than a number
// hand-written per quest. Raising a tier here raises it everywhere that tier appears.
const QUEST_RARITY_REWARDS = Object.freeze({
    Common: { xp: 10, lumen: 5, crates: 0 },
    Uncommon: { xp: 20, lumen: 10, crates: 0 },
    Rare: { xp: 30, lumen: 18, crates: 0 },
    Epic: { xp: 50, lumen: 25, crates: 1 },
    Legendary: { xp: 80, lumen: 40, crates: 2 },
})

// Weighted so a Legendary board slot is a genuine event - roughly one every two weeks per slot -
// rather than something a student comes to expect daily.
const QUEST_RARITY_WEIGHTS = Object.freeze({
    Common: 40,
    Uncommon: 32,
    Rare: 19,
    Epic: 7,
    Legendary: 2,
})

const RARITY_LADDER = Object.freeze(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'])

// Every quest's metric has to be something the app actually emits: task_completed,
// resource_published, heart_given, match_played, match_won, or mode:<modeId>. A quest wired to a
// metric nothing fires can never be completed, which is a dead slot on the student's board.
const QUEST_CATALOG = Object.freeze([
    { id: 'tasks-1', group: 'study', rarity: 'Common', label: 'Complete 1 task', metric: 'task_completed', target: 1 },
    { id: 'tasks-3', group: 'study', rarity: 'Uncommon', label: 'Complete 3 tasks', metric: 'task_completed', target: 3 },
    { id: 'tasks-5', group: 'study', rarity: 'Rare', label: 'Complete 5 tasks', metric: 'task_completed', target: 5 },
    { id: 'tasks-8', group: 'study', rarity: 'Epic', label: 'Complete 8 tasks', metric: 'task_completed', target: 8 },
    { id: 'tasks-12', group: 'study', rarity: 'Legendary', label: 'Complete 12 tasks', metric: 'task_completed', target: 12 },

    { id: 'matches-1', group: 'play', rarity: 'Common', label: 'Play 1 ranked match', metric: 'match_played', target: 1 },
    { id: 'matches-3', group: 'play', rarity: 'Uncommon', label: 'Play 3 ranked matches', metric: 'match_played', target: 3 },
    { id: 'win-1', group: 'play', rarity: 'Uncommon', label: 'Win 1 ranked match', metric: 'match_won', target: 1 },
    { id: 'mode-sat-classic', group: 'play', rarity: 'Uncommon', label: 'Play 2 matches of Classic', metric: 'mode:sat-classic', target: 2 },
    { id: 'mode-sat-timber', group: 'play', rarity: 'Uncommon', label: 'Play 2 matches of Timber', metric: 'mode:sat-timber', target: 2 },
    { id: 'mode-sat-puncture', group: 'play', rarity: 'Uncommon', label: 'Play 2 matches of Puncture', metric: 'mode:sat-puncture', target: 2 },
    { id: 'mode-sat-flutter', group: 'play', rarity: 'Uncommon', label: 'Play 2 matches of Flutter', metric: 'mode:sat-flutter', target: 2 },
    { id: 'win-2', group: 'play', rarity: 'Rare', label: 'Win 2 ranked matches', metric: 'match_won', target: 2 },
    { id: 'matches-6', group: 'play', rarity: 'Rare', label: 'Play 6 ranked matches', metric: 'match_played', target: 6 },
    { id: 'win-3', group: 'play', rarity: 'Epic', label: 'Win 3 ranked matches', metric: 'match_won', target: 3 },
    { id: 'win-5', group: 'play', rarity: 'Legendary', label: 'Win 5 ranked matches', metric: 'match_won', target: 5 },

    { id: 'hearts-1', group: 'share', rarity: 'Common', label: 'Heart 1 resource', metric: 'heart_given', target: 1 },
    { id: 'hearts-3', group: 'share', rarity: 'Uncommon', label: 'Heart 3 resources', metric: 'heart_given', target: 3 },
    { id: 'hearts-8', group: 'share', rarity: 'Rare', label: 'Heart 8 resources', metric: 'heart_given', target: 8 },
])


const questRarityReward = (rarity) => QUEST_RARITY_REWARDS[rarity] ?? QUEST_RARITY_REWARDS.Common

const hashSeed = (value) => {
    let hash = 2166136261
    for(let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 16777619) >>> 0
    }
    return hash
}

const seededRandom = (seed) => {
    let state = (seed >>> 0) || 1
    return () => {
        state ^= state << 13
        state ^= state >>> 17
        state ^= state << 5
        return (state >>> 0) / 4294967296
    }
}

const RARITY_TOTAL_WEIGHT = RARITY_LADDER.reduce((total, rarity) => total + QUEST_RARITY_WEIGHTS[rarity], 0)

const rollRarity = (roll) => {
    let remaining = roll * RARITY_TOTAL_WEIGHT
    for(const rarity of RARITY_LADDER) {
        remaining -= QUEST_RARITY_WEIGHTS[rarity]
        if(remaining < 0) return rarity
    }
    return 'Common'
}

// Picks at the rolled rarity from the whole catalog, stepping down the ladder when nothing at that
// tier is left, so a roll is never wasted and a slot is never empty. Slots are not tied to a group:
// a board of three study quests is possible, and a group is never guaranteed a seat.
const pickQuest = (rarity, random, excludeIds = []) => {
    const excluded = new Set(excludeIds.filter(Boolean))
    const startIndex = RARITY_LADDER.indexOf(rarity)
    for(let index = startIndex; index >= 0; index -= 1) {
        const pool = QUEST_CATALOG.filter((quest) => quest.rarity === RARITY_LADDER[index] && !excluded.has(quest.id))
        if(pool.length) return pool[Math.floor(random() * pool.length) % pool.length]
    }
    return QUEST_CATALOG.find((quest) => !excluded.has(quest.id)) ?? null
}

// Initial slots are stable across dates. Stored slots become authoritative after a claim or reroll.
// The dayKey argument remains for callers that also track daily task and reroll limits.
const pickDailyQuests = (userId, dayKey, storedQuestIds = null) => {
    if(Array.isArray(storedQuestIds) && storedQuestIds.length === DAILY_QUEST_COUNT) {
        const resolved = storedQuestIds.map((id) => questById(id))
        if(resolved.every(Boolean)) return resolved
    }

    const random = seededRandom(hashSeed(`${userId}:continuous`))
    const picked = []

    // Each slot excludes what the earlier ones took, so the same quest never fills two of them.
    while(picked.length < DAILY_QUEST_COUNT) {
        const quest = pickQuest(rollRarity(random()), random, picked.map((entry) => entry.id))
        if(!quest) break
        picked.push(quest)
    }

    return picked
}

const questById = (id) => QUEST_CATALOG.find((quest) => quest.id === id) ?? null

const describeQuest = (quest, progress = {}, completed = {}, cycles = {}) => {
    const reward = questRarityReward(quest.rarity)
    return {
        id: quest.id,
        instanceId: `${quest.id}:${cycles[quest.id] || 0}`,
        label: quest.label,
        group: quest.group,
        rarity: quest.rarity,
        target: quest.target,
        current: Math.min(quest.target, Number(progress[quest.id]) || 0),
        completed: Boolean(completed[quest.id]),
        xp: reward.xp,
        lumen: reward.lumen,
        crates: reward.crates,
    }
}

const questDayRef = (userId) => db.collection('questBoards').doc(String(userId))

const resolveDayKey = (account, requestedZone = 'UTC') => {
    const candidate = account.user?.preferences?.timeZone || account.progress?.timeZone || requestedZone
    try {
        new Intl.DateTimeFormat('en', { timeZone: candidate }).format()
        return localDayKey(new Date(), candidate)
    } catch {
        return localDayKey(new Date(), 'UTC')
    }
}

// Folds quest progress into an in-flight transaction. The caller is responsible
// for having read `daySnap` before any writes. Completion makes a card claimable;
// only claimQuest pays rewards, atomically with the replacement.
const applyQuestProgress = (transaction, { userId, dayKey, daySnap, metric = null, amount = 1, events = null, circleContexts = [] }) => {

    const stored = daySnap?.data() ?? {}
    const quests = pickDailyQuests(userId, dayKey, stored.questIds)
    const progress = { ...(stored.progress || {}) }
    const completed = { ...(stored.completed || {}) }

    // One match can satisfy several quests at once, so events are applied together
    // against a single snapshot rather than one write per metric.
    const pending = events ?? [{ metric, amount }]
    const justCompleted = []
    let advanced = false

    for(const event of pending) {
        const matching = quests.filter((quest) => quest.metric === event.metric && !completed[quest.id])

        for(const quest of matching) {
            const next = Math.min(quest.target, (Number(progress[quest.id]) || 0) + Math.max(0, event.amount ?? 1))

            if(next === (Number(progress[quest.id]) || 0)) continue

            progress[quest.id] = next
            advanced = true

            if(next >= quest.target) {
                completed[quest.id] = true
                justCompleted.push(quest)
            }
        }
    }

    const described = quests.map((quest) => describeQuest(quest, progress, completed, stored.cycles))

    if(!advanced) {
        return { reward: { xp: 0, lumen: 0, crates: 0 }, completed: [], quests: described }
    }

    transaction.set(questDayRef(userId, dayKey), {
        userId,
        dayKey,
        questIds: quests.map((quest) => quest.id),
        progress,
        completed,
        updatedAt: new Date(),
    }, { merge: true })


    contributeQuests(transaction, circleContexts, { userId, dayKey, completed: justCompleted.map(quest => describeQuest(quest, progress, completed, stored.cycles)) })

    return {
        reward: { xp: 0, lumen: 0, crates: 0 },
        completed: justCompleted.map((quest) => describeQuest(quest, progress, completed, stored.cycles)),
        quests: described,
    }
}

const getQuestBoard = async (userId, timeZone = 'UTC') => db.runTransaction(async (transaction) => {
    const account = await readAccount(transaction, userId)
    const dayKey = resolveDayKey(account, timeZone)
    const ref = questDayRef(userId)
    const daySnap = await transaction.get(ref)
    let stored = daySnap.data() ?? {}
    if(!daySnap.exists) {
        // Carry today's unfinished work forward. Old completed quests have already paid
        // automatically, so reset those slots rather than making their reward claimable again.
        const legacy = await transaction.get(db.collection('questDays').doc(`${userId}_${dayKey}`))
        stored = legacy.data() ?? {}
        const progress = { ...(stored.progress || {}) }
        const cycles = { ...(stored.cycles || {}) }
        for(const id of Object.keys(stored.completed || {})) {
            if(!stored.completed[id]) continue
            delete progress[id]
            cycles[id] = (cycles[id] || 0) + 1
        }
        stored = { ...stored, userId, progress, completed: {}, cycles,
            questIds: pickDailyQuests(userId, dayKey, stored.questIds).map((quest) => quest.id),
            rerollDay: dayKey, updatedAt: new Date() }
        transaction.set(ref, stored)
    }
    return {
        dayKey,
        rerollsRemaining: Math.max(0, DAILY_REROLLS - ((stored.rerollDay === dayKey ? Number(stored.rerollsUsed) : 0) || 0)),
        rerollsTotal: DAILY_REROLLS,
        quests: pickDailyQuests(userId, dayKey, stored.questIds)
            .map((quest) => describeQuest(quest, stored.progress || {}, stored.completed || {}, stored.cycles)),
    }
})

// Swaps one unfinished quest for another, rerolling its rarity too. The board is
// written out in full afterwards, because from this point the stored ids - not the day's seed -
// are what the board means. Only the reroll allowance resets daily.
const rerollQuest = async (userId, questId, timeZone = 'UTC') => db.runTransaction(async (transaction) => {
    const account = await readAccount(transaction, userId)
    const dayKey = resolveDayKey(account, timeZone)
    const dayRef = questDayRef(userId, dayKey)
    const daySnap = await transaction.get(dayRef)
    const stored = daySnap.data() ?? {}

    const rerollsUsed = Math.max(0, (stored.rerollDay === dayKey ? Number(stored.rerollsUsed) : 0) || 0)
    if(rerollsUsed >= DAILY_REROLLS) throw new Error('No rerolls left today.')

    const quests = pickDailyQuests(userId, dayKey, stored.questIds)
    const index = quests.findIndex((quest) => quest.id === String(questId ?? ''))
    if(index === -1) throw new Error('That quest is no longer on your board.')

    const target = quests[index]
    const completed = { ...(stored.completed || {}) }
    if(completed[target.id]) throw new Error('That quest is already complete.')

    const alreadyOnBoard = new Set(quests.map((quest) => quest.id))
    const random = seededRandom(hashSeed(`${userId}:${dayKey}:reroll:${rerollsUsed}:${target.id}`))

    // Reroll rarity as well as the quest, so a reroll is a real gamble rather than a sideways step
    // within the same tier - and never hands back something already on the board.
    let replacement = null
    for(let attempt = 0; attempt < 12 && !replacement; attempt += 1) {
        const candidate = pickQuest(rollRarity(random()), random, [...alreadyOnBoard])
        if(candidate && !alreadyOnBoard.has(candidate.id)) replacement = candidate
    }
    replacement ??= QUEST_CATALOG.find((quest) => !alreadyOnBoard.has(quest.id))
    if(!replacement) throw new Error('Nothing left to reroll into.')

    const nextQuests = quests.map((quest) => (quest.id === target.id ? replacement : quest))

    // The replaced quest's progress goes with it; the student is starting that slot over.
    const progress = { ...(stored.progress || {}) }
    delete progress[target.id]
    delete progress[replacement.id]
    delete completed[target.id]
    delete completed[replacement.id]
    const cycles = { ...(stored.cycles || {}), [replacement.id]: (stored.cycles?.[replacement.id] || 0) + 1 }

    transaction.set(dayRef, {
        ...stored,
        userId,
        dayKey,
        questIds: nextQuests.map((quest) => quest.id),
        progress,
        completed,
        cycles,
        rerollDay: dayKey,
        rerollsUsed: rerollsUsed + 1,
        updatedAt: new Date(),
    })

    return {
        dayKey,
        rerollsRemaining: Math.max(0, DAILY_REROLLS - (rerollsUsed + 1)),
        rerollsTotal: DAILY_REROLLS,
        replaced: target.id,
        quests: nextQuests.map((quest) => describeQuest(quest, progress, completed, cycles)),
    }
})

// Claim and replacement share a transaction; the instance token rejects a stale card even
// when the same catalog quest returns in a later cycle.
const cycleQuest = (stored, quests, questId, instanceId, random = () => randomInt(1_000_000) / 1_000_000) => {
    const index = quests.findIndex((quest) => quest.id === questId)
    if(index < 0) throw new Error('That quest is no longer on your board.')
    const target = quests[index]
    if(instanceId !== `${target.id}:${stored.cycles?.[target.id] || 0}`) throw new Error('That quest has already been replaced.')
    if(!stored.completed?.[target.id] || (stored.progress?.[target.id] || 0) < target.target) throw new Error('Finish this quest before claiming it.')
    const rarity = rollRarity(random())
    const replacement = pickQuest(rarity, random, quests.map((quest) => quest.id))
    const nextQuests = quests.map((quest, slot) => slot === index ? replacement : quest)
    const progress = { ...(stored.progress || {}) }
    const completed = { ...(stored.completed || {}) }
    delete progress[target.id]
    delete progress[replacement.id]
    delete completed[target.id]
    delete completed[replacement.id]
    const cycles = { ...(stored.cycles || {}), [replacement.id]: (stored.cycles?.[replacement.id] || 0) + 1 }
    return { target, nextQuests, progress, completed, cycles, reward: questRarityReward(target.rarity) }
}

const claimQuest = async (userId, questId, instanceId, timeZone = 'UTC') => db.runTransaction(async (transaction) => {
    const account = await readAccount(transaction, userId)
    const dayKey = resolveDayKey(account, timeZone)
    const ref = questDayRef(userId)
    const snap = await transaction.get(ref)
    const stored = snap.data() ?? {}
    const quests = pickDailyQuests(userId, dayKey, stored.questIds)
    const next = cycleQuest(stored, quests, questId, instanceId)
    transaction.set(ref, {
        ...stored, userId, questIds: next.nextQuests.map((quest) => quest.id),
        progress: next.progress, completed: next.completed, cycles: next.cycles, updatedAt: new Date(),
    })
    const accountResult = writeAccount(transaction, account, next.reward)
    return {
        ...accountResult, reward: next.reward,
        rerollsRemaining: Math.max(0, DAILY_REROLLS - ((stored.rerollDay === dayKey ? Number(stored.rerollsUsed) : 0) || 0)),
        rerollsTotal: DAILY_REROLLS,
        quests: next.nextQuests.map((quest) => describeQuest(quest, next.progress, next.completed, next.cycles)),
    }
})

// Standalone entry point for events that are not already inside a transaction.
const recordQuestEvent = async (userId, metric, { amount = 1, timeZone = 'UTC' } = {}) => db.runTransaction(async (transaction) => {

    const account = await readAccount(transaction, userId)
    const dayKey = resolveDayKey(account, timeZone)
    const daySnap = await transaction.get(questDayRef(userId, dayKey))

    const circleContexts = await readCircleContexts(transaction, [userId])
    const result = applyQuestProgress(transaction, { userId, dayKey, daySnap, metric, amount, circleContexts })
    const { progress, wallet } = writeAccount(transaction, account, {
        xp: result.reward.xp,
        lumen: result.reward.lumen,
        crates: result.reward.crates,
    })

    return { ...result, progress, wallet }
})

export {
    DAILY_QUEST_COUNT, DAILY_REROLLS, QUEST_CATALOG, QUEST_RARITY_REWARDS, QUEST_RARITY_WEIGHTS,
    RARITY_LADDER, claimQuest, cycleQuest, applyQuestProgress, describeQuest, getQuestBoard, pickDailyQuests, questById,
    questDayRef, questRarityReward, recordQuestEvent, rerollQuest, resolveDayKey, rollRarity,
}
