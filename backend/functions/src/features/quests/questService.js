import { db } from '../../lib/firebaseAdmin.js'
import { readAccount, writeAccount } from '../economy/economyService.js'
import { localDayKey } from '../economy/progression.js'

const DAILY_QUEST_COUNT = 3

// Quests are grouped so a student always gets one of each kind per day.
const QUEST_CATALOG = Object.freeze([
    { id: 'tasks-3', group: 'study', label: 'Knock out three tasks', metric: 'task_completed', target: 3, xp: 15, lumen: 5 },
    { id: 'tasks-5', group: 'study', label: 'Clear five tasks', metric: 'task_completed', target: 5, xp: 25, lumen: 10 },
    { id: 'tasks-1', group: 'study', label: 'Finish your first task', metric: 'task_completed', target: 1, xp: 10, lumen: 5 },

    { id: 'matches-3', group: 'play', label: 'Play three ranked games', metric: 'match_played', target: 3, xp: 20, lumen: 10 },
    { id: 'win-1', group: 'play', label: 'Win a ranked game', metric: 'match_won', target: 1, xp: 20, lumen: 10 },
    { id: 'win-2', group: 'play', label: 'Win two ranked games', metric: 'match_won', target: 2, xp: 35, lumen: 20 },
    { id: 'mode-sat-classic', group: 'play', label: 'Play two SAT Classic games', metric: 'mode:sat-classic', target: 2, xp: 20, lumen: 10 },
    { id: 'mode-sat-timber', group: 'play', label: 'Play two Timber games', metric: 'mode:sat-timber', target: 2, xp: 20, lumen: 10 },
    { id: 'mode-sat-puncture', group: 'play', label: 'Play two Puncture games', metric: 'mode:sat-puncture', target: 2, xp: 20, lumen: 10 },
    { id: 'mode-sat-flutter', group: 'play', label: 'Play two Flutter games', metric: 'mode:sat-flutter', target: 2, xp: 20, lumen: 10 },

    { id: 'hearts-3', group: 'share', label: 'Heart three resources', metric: 'heart_given', target: 3, xp: 10, lumen: 5 },
    { id: 'resource-1', group: 'share', label: 'Publish a resource', metric: 'resource_published', target: 1, xp: 25, lumen: 15 },
    { id: 'lesson-read-1', group: 'share', label: 'Open a lesson someone made', metric: 'lesson_opened', target: 1, xp: 10, lumen: 5 },
])

const QUEST_GROUPS = ['study', 'play', 'share']

const hashSeed = (value) => {
    let hash = 2166136261
    for(let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 16777619) >>> 0
    }
    return hash
}

// The same student always sees the same three quests for a given local day,
// so the board is stable without writing it ahead of time.
const pickDailyQuests = (userId, dayKey) => {
    const seed = hashSeed(`${userId}:${dayKey}`)
    return QUEST_GROUPS.map((group, index) => {
        const pool = QUEST_CATALOG.filter((quest) => quest.group === group)
        return pool[(seed >>> (index * 5)) % pool.length]
    }).slice(0, DAILY_QUEST_COUNT)
}

const questById = (id) => QUEST_CATALOG.find((quest) => quest.id === id) ?? null

const describeQuest = (quest, progress = {}, completed = {}) => ({
    id: quest.id,
    label: quest.label,
    group: quest.group,
    target: quest.target,
    current: Math.min(quest.target, Number(progress[quest.id]) || 0),
    completed: Boolean(completed[quest.id]),
    xp: quest.xp,
    lumen: quest.lumen,
})

const questDayRef = (userId, dayKey) => db.collection('questDays').doc(`${userId}_${dayKey}`)

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
// for having read `daySnap` before any writes, and for passing the reward on to
// writeAccount so XP and Lumen land in the same atomic update.
const applyQuestProgress = (transaction, { userId, dayKey, daySnap, metric = null, amount = 1, events = null }) => {

    const quests = pickDailyQuests(userId, dayKey)
    const stored = daySnap?.data() ?? {}
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

    const described = quests.map((quest) => describeQuest(quest, progress, completed))

    if(!advanced) {
        return { reward: { xp: 0, lumen: 0 }, completed: [], quests: described }
    }

    transaction.set(questDayRef(userId, dayKey), {
        userId,
        dayKey,
        questIds: quests.map((quest) => quest.id),
        progress,
        completed,
        updatedAt: new Date(),
    }, { merge: true })

    return {
        reward: {
            xp: justCompleted.reduce((total, quest) => total + quest.xp, 0),
            lumen: justCompleted.reduce((total, quest) => total + quest.lumen, 0),
        },
        completed: justCompleted.map((quest) => describeQuest(quest, progress, completed)),
        quests: described,
    }
}

const getQuestBoard = async (userId, timeZone = 'UTC') => db.runTransaction(async (transaction) => {
    const account = await readAccount(transaction, userId)
    const dayKey = resolveDayKey(account, timeZone)
    const daySnap = await transaction.get(questDayRef(userId, dayKey))
    const stored = daySnap.data() ?? {}
    return {
        dayKey,
        quests: pickDailyQuests(userId, dayKey).map((quest) => describeQuest(quest, stored.progress || {}, stored.completed || {})),
    }
})

// Standalone entry point for events that are not already inside a transaction.
const recordQuestEvent = async (userId, metric, { amount = 1, timeZone = 'UTC' } = {}) => db.runTransaction(async (transaction) => {

    const account = await readAccount(transaction, userId)
    const dayKey = resolveDayKey(account, timeZone)
    const daySnap = await transaction.get(questDayRef(userId, dayKey))

    const result = applyQuestProgress(transaction, { userId, dayKey, daySnap, metric, amount })
    const { progress, wallet } = writeAccount(transaction, account, result.reward)

    return { ...result, progress, wallet }
})

export {
    DAILY_QUEST_COUNT, QUEST_CATALOG, applyQuestProgress, getQuestBoard,
    pickDailyQuests, questById, questDayRef, recordQuestEvent, resolveDayKey,
}
