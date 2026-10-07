import { strict as assert } from 'node:assert'
import test from 'node:test'
import { DAILY_QUEST_COUNT, applyQuestProgress, pickDailyQuests } from './questService.js'

const fakeTransaction = () => {
    const writes = []
    return { writes, set: (ref, value) => writes.push({ ref, value }) }
}

const snapshotOf = (data) => ({ data: () => data })

test('daily quests are stable for a user and day, and cover each group', () => {
    const first = pickDailyQuests('user-a', '2026-10-05')
    const second = pickDailyQuests('user-a', '2026-10-05')

    assert.equal(first.length, DAILY_QUEST_COUNT)
    assert.deepEqual(first.map((quest) => quest.id), second.map((quest) => quest.id))
    assert.deepEqual(first.map((quest) => quest.group), ['study', 'play', 'share'])
})

test('different users and days get different boards', () => {
    const byUser = new Set([
        pickDailyQuests('user-a', '2026-10-05').map((quest) => quest.id).join(),
        pickDailyQuests('user-b', '2026-10-05').map((quest) => quest.id).join(),
        pickDailyQuests('user-a', '2026-10-06').map((quest) => quest.id).join(),
    ])

    assert.ok(byUser.size > 1)
})

test('progress advances only matching quests and pays out once', () => {
    const [studyQuest] = pickDailyQuests('user-a', '2026-10-05')
    const transaction = fakeTransaction()

    const progress = {}
    for(let step = 0; step < studyQuest.target; step += 1) {
        const result = applyQuestProgress(transaction, {
            userId: 'user-a',
            dayKey: '2026-10-05',
            daySnap: snapshotOf({ progress: { ...progress }, completed: {} }),
            metric: 'task_completed',
        })
        progress[studyQuest.id] = result.quests.find((quest) => quest.id === studyQuest.id).current
    }

    const final = applyQuestProgress(transaction, {
        userId: 'user-a',
        dayKey: '2026-10-05',
        daySnap: snapshotOf({ progress: { [studyQuest.id]: studyQuest.target - 1 }, completed: {} }),
        metric: 'task_completed',
    })

    assert.equal(final.completed.length, 1)
    assert.equal(final.reward.xp, studyQuest.xp)
    assert.equal(final.reward.lumen, studyQuest.lumen)
})

test('an already completed quest pays nothing more and writes nothing', () => {
    const [studyQuest] = pickDailyQuests('user-a', '2026-10-05')
    const transaction = fakeTransaction()

    const result = applyQuestProgress(transaction, {
        userId: 'user-a',
        dayKey: '2026-10-05',
        daySnap: snapshotOf({ progress: { [studyQuest.id]: studyQuest.target }, completed: { [studyQuest.id]: true } }),
        metric: 'task_completed',
    })

    assert.deepEqual(result.reward, { xp: 0, lumen: 0 })
    assert.equal(result.completed.length, 0)
    assert.equal(transaction.writes.length, 0)
})

test('one match applies every matching metric against a single snapshot', () => {
    // Pick a user whose play quest is a win quest, so a single match can satisfy
    // match_played, the mode metric, and match_won together.
    const userId = Array.from({ length: 200 }, (_, index) => `player-${index}`)
        .find((candidate) => pickDailyQuests(candidate, '2026-10-05').find((quest) => quest.group === 'play').metric === 'match_won')

    assert.ok(userId, 'expected at least one seeded user with a win quest')

    const transaction = fakeTransaction()
    const result = applyQuestProgress(transaction, {
        userId,
        dayKey: '2026-10-05',
        daySnap: snapshotOf({}),
        events: [
            { metric: 'match_played', amount: 1 },
            { metric: 'mode:sat-classic', amount: 1 },
            { metric: 'match_won', amount: 1 },
        ],
    })

    const playQuest = result.quests.find((quest) => quest.group === 'play')

    assert.equal(playQuest.current, 1, 'the play quest should advance from a single match')
    assert.equal(transaction.writes.length, 1, 'all metrics share one write')
})

test('quest rewards never exceed the quest target', () => {
    const transaction = fakeTransaction()
    const [studyQuest] = pickDailyQuests('user-a', '2026-10-05')

    const result = applyQuestProgress(transaction, {
        userId: 'user-a',
        dayKey: '2026-10-05',
        daySnap: snapshotOf({}),
        metric: 'task_completed',
        amount: 999,
    })

    assert.equal(result.quests.find((quest) => quest.id === studyQuest.id).current, studyQuest.target)
    assert.equal(result.reward.xp, studyQuest.xp)
})
