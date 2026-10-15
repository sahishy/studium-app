import { strict as assert } from 'node:assert'
import test from 'node:test'
import { buildMatchQuestEvents } from './matchQuestEvents.js'
import { DAILY_QUEST_COUNT, QUEST_CATALOG, QUEST_RARITY_REWARDS, RARITY_LADDER, cycleQuest, applyQuestProgress, pickDailyQuests, questRarityReward, rollRarity } from './questService.js'

const fakeTransaction = () => {
    const writes = []
    return { writes, set: (ref, value) => writes.push({ ref, value }) }
}

const snapshotOf = (data) => ({ data: () => data })

test('all nine new families scale targets with rarity and total 43 quests', () => {
    const metrics = ['round_won', 'question_correct', 'math_question_correct', 'reading_question_correct',
        'flutter_ring_cleared', 'timber_log_chopped', 'puncture_pin_placed', 'timber_clean_win', 'puncture_clean_win']
    const quests = QUEST_CATALOG.filter((quest) => metrics.includes(quest.metric))
    assert.equal(quests.length, 43)
    assert.equal(new Set(QUEST_CATALOG.map((quest) => quest.id)).size, QUEST_CATALOG.length)
    for(const metric of metrics) {
        const family = quests.filter((quest) => quest.metric === metric)
        assert.equal(family.length, metric.endsWith('clean_win') ? 4 : 5)
        for(let index = 1; index < family.length; index += 1) {
            assert.ok(family[index].target > family[index - 1].target)
            assert.ok(RARITY_LADDER.indexOf(family[index].rarity) > RARITY_LADDER.indexOf(family[index - 1].rarity))
        }
        if(metric.endsWith('clean_win')) assert.ok(family.every((quest) => /^Win .*game.*without getting stunned$/.test(quest.label)))
    }
})

test('new match events advance several objectives together, accumulate, and cap completion', () => {
    const questIds = ['correct-8', 'math-correct-4', 'timber-logs-75']
    const match = { modeId: 'sat-timber', ranked: true, endReason: 'first_to_three', roundsPlayed: 3,
        winnerUserId: 'other', participationByUserId: { player: 3 } }
    const events = buildMatchQuestEvents(match, 'player', { correct: 5, byDomain: { Algebra: { correct: 3 } } }, { timberLogsChopped: 90 })
    let stored = { questIds }
    for(let index = 0; index < 2; index += 1) {
        const result = applyQuestProgress(fakeTransaction(), { userId: 'player', dayKey: '2026-10-14', daySnap: snapshotOf(stored), events })
        stored = { questIds, progress: Object.fromEntries(result.quests.map((quest) => [quest.id, quest.current])),
            completed: Object.fromEntries(result.quests.map((quest) => [quest.id, quest.completed])) }
        assert.equal(result.reward.xp, 0)
    }
    assert.deepEqual(stored.progress, { 'correct-8': 8, 'math-correct-4': 4, 'timber-logs-75': 150 })
    assert.ok(Object.values(stored.completed).every(Boolean))
    const transaction = fakeTransaction()
    applyQuestProgress(transaction, { userId: 'player', dayKey: '2026-10-14', daySnap: snapshotOf(stored), events })
    assert.equal(transaction.writes.length, 0)
})

test('daily quests are stable for a user and day, and never repeat a quest', () => {
    const first = pickDailyQuests('user-a', '2026-10-05')
    const second = pickDailyQuests('user-a', '2026-10-05')

    assert.equal(first.length, DAILY_QUEST_COUNT)
    assert.deepEqual(first.map((quest) => quest.id), second.map((quest) => quest.id))
    assert.equal(new Set(first.map((quest) => quest.id)).size, DAILY_QUEST_COUNT)
})

test('different users get different initial boards', () => {
    const byUser = new Set([
        pickDailyQuests('user-a', '2026-10-05').map((quest) => quest.id).join(),
        pickDailyQuests('user-b', '2026-10-05').map((quest) => quest.id).join(),
        pickDailyQuests('user-a', '2026-10-06').map((quest) => quest.id).join(),
    ])

    assert.ok(byUser.size > 1)
})

test('progress advances matching quests and makes rewards claimable without paying', () => {
    const questIds = ['tasks-3', 'matches-1', 'hearts-1']
    const studyQuest = QUEST_CATALOG.find((quest) => quest.id === 'tasks-3')
    const transaction = fakeTransaction()

    const progress = {}
    for(let step = 0; step < studyQuest.target; step += 1) {
        const result = applyQuestProgress(transaction, {
            userId: 'user-a',
            dayKey: '2026-10-05',
            daySnap: snapshotOf({ questIds, progress: { ...progress }, completed: {} }),
            metric: 'task_completed',
        })
        progress[studyQuest.id] = result.quests.find((quest) => quest.id === studyQuest.id).current
    }

    const final = applyQuestProgress(transaction, {
        userId: 'user-a',
        dayKey: '2026-10-05',
        daySnap: snapshotOf({ questIds, progress: { [studyQuest.id]: studyQuest.target - 1 }, completed: {} }),
        metric: 'task_completed',
    })

    assert.equal(final.completed.length, 1)
    assert.equal(final.reward.xp, 0)
    assert.equal(final.reward.lumen, 0)
    assert.equal(final.reward.crates, 0)
})

test('an already completed quest pays nothing more and writes nothing', () => {
    const [firstQuest] = pickDailyQuests('user-a', '2026-10-05')
    const transaction = fakeTransaction()

    const result = applyQuestProgress(transaction, {
        userId: 'user-a',
        dayKey: '2026-10-05',
        daySnap: snapshotOf({ progress: { [firstQuest.id]: firstQuest.target }, completed: { [firstQuest.id]: true } }),
        metric: firstQuest.metric,
    })

    assert.deepEqual(result.reward, { xp: 0, lumen: 0, crates: 0 })
    assert.equal(result.completed.length, 0)
    assert.equal(transaction.writes.length, 0)
})

test('one match applies every matching metric against a single snapshot', () => {
    // Pick a user whose play quest is a win quest, so a single match can satisfy
    // match_played, the mode metric, and match_won together.
    const userId = Array.from({ length: 200 }, (_, index) => `player-${index}`)
        .find((candidate) => pickDailyQuests(candidate, '2026-10-05').some((quest) => quest.metric === 'match_won'))

    assert.ok(userId, 'expected at least one seeded user with a win quest')

    const winQuest = pickDailyQuests(userId, '2026-10-05').find((quest) => quest.metric === 'match_won')

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

    const playQuest = result.quests.find((quest) => quest.id === winQuest.id)

    assert.equal(playQuest.current, 1, 'the win quest should advance from a single match')
    assert.equal(transaction.writes.length, 1, 'all metrics share one write')
})

test('quest rewards never exceed the quest target', () => {
    const transaction = fakeTransaction()
    const [firstQuest] = pickDailyQuests('user-a', '2026-10-05')

    const result = applyQuestProgress(transaction, {
        userId: 'user-a',
        dayKey: '2026-10-05',
        daySnap: snapshotOf({}),
        metric: firstQuest.metric,
        amount: 999,
    })

    assert.equal(result.quests.find((quest) => quest.id === firstQuest.id).current, firstQuest.target)
    assert.equal(result.reward.xp, 0)
})

test('every catalog quest is wired to a metric the app actually emits', () => {
    // A quest pointing at a metric nothing fires can never be completed, which leaves a dead slot
    // on the student's board. `lesson_opened` was exactly that before this list existed.
    const emitted = new Set([
        'task_completed', 'resource_published', 'heart_given', 'match_played', 'match_won',
        'round_won', 'question_correct', 'math_question_correct', 'reading_question_correct',
        'flutter_ring_cleared', 'timber_log_chopped', 'puncture_pin_placed', 'puncture_clean_win', 'timber_clean_win',
        'mode:sat-classic', 'mode:sat-timber', 'mode:sat-puncture', 'mode:sat-flutter',
    ])
    for(const quest of QUEST_CATALOG) {
        assert.ok(emitted.has(quest.metric), `${quest.id} uses unemitted metric ${quest.metric}`)
    }
})

test('every catalog quest declares a known rarity, and rewards rise with it', () => {
    for(const quest of QUEST_CATALOG) {
        assert.ok(RARITY_LADDER.includes(quest.rarity), `${quest.id} has rarity ${quest.rarity}`)
    }
    for(let index = 1; index < RARITY_LADDER.length; index += 1) {
        const lower = QUEST_RARITY_REWARDS[RARITY_LADDER[index - 1]]
        const higher = QUEST_RARITY_REWARDS[RARITY_LADDER[index]]
        assert.ok(higher.xp > lower.xp, `${RARITY_LADDER[index]} should pay more xp`)
        assert.ok(higher.lumen > lower.lumen, `${RARITY_LADDER[index]} should pay more lumen`)
        assert.ok(higher.crates >= lower.crates)
    }
    assert.equal(QUEST_RARITY_REWARDS.Epic.crates, 1)
    assert.equal(QUEST_RARITY_REWARDS.Legendary.crates, 2)
})

test('rarity rolls follow the published weights, and legendary stays a treat', () => {
    const counts = {}
    const samples = 60_000
    for(let index = 0; index < samples; index += 1) {
        const rarity = rollRarity(index / samples)
        counts[rarity] = (counts[rarity] || 0) + 1
    }
    assert.ok(counts.Common / samples > 0.35 && counts.Common / samples < 0.45)
    assert.ok(counts.Legendary / samples > 0.01 && counts.Legendary / samples < 0.03)
})

test('a board slot never sits empty when nothing is left at the rolled rarity', () => {
    // A Legendary roll has very little to draw from, so it must step down the ladder rather than
    // produce no quest at all - and an exhausted tier must never leave a duplicate behind either.
    for(let index = 0; index < 400; index += 1) {
        const quests = pickDailyQuests(`seeded-${index}`, '2026-10-09')
        assert.equal(quests.length, DAILY_QUEST_COUNT)
        assert.ok(quests.every(Boolean))
        assert.equal(new Set(quests.map((quest) => quest.id)).size, DAILY_QUEST_COUNT)
    }
})

test('a board slot is not tied to a quest group', () => {
    const firstSlotGroups = new Set(
        Array.from({ length: 200 }, (_, index) => pickDailyQuests(`spread-${index}`, '2026-10-09')[0].group),
    )

    assert.ok(firstSlotGroups.size > 1, 'the first slot should not always hold the same group')
})

test('stored quest ids win over the day seed, so a reroll is not undone on the next read', () => {
    const derived = pickDailyQuests('user-a', '2026-10-05')
    const swapped = QUEST_CATALOG.find((quest) => !derived.some((entry) => entry.id === quest.id))
    const storedIds = [swapped.id, derived[1].id, derived[2].id]

    const resolved = pickDailyQuests('user-a', '2026-10-05', storedIds)
    assert.deepEqual(resolved.map((quest) => quest.id), storedIds)

    // A stored board referencing a quest that no longer exists falls back to the seed rather
    // than handing back a board with a hole in it.
    const stale = pickDailyQuests('user-a', '2026-10-05', ['gone', derived[1].id, derived[2].id])
    assert.deepEqual(stale.map((quest) => quest.id), derived.map((quest) => quest.id))
})

test('progress is tracked against the stored board, not the seeded one', () => {
    const derived = pickDailyQuests('user-a', '2026-10-05')
    const replacement = QUEST_CATALOG.find((quest) => (
        quest.metric === 'task_completed' && !derived.some((entry) => entry.id === quest.id)
    ))
    const transaction = fakeTransaction()

    const result = applyQuestProgress(transaction, {
        userId: 'user-a',
        dayKey: '2026-10-05',
        daySnap: snapshotOf({ questIds: [replacement.id, derived[1].id, derived[2].id], progress: {}, completed: {} }),
        metric: 'task_completed',
    })

    assert.ok(result.quests.some((quest) => quest.id === replacement.id))
    assert.ok(!result.quests.some((quest) => quest.id === derived[0].id && derived[0].id !== replacement.id))
    assert.deepEqual(transaction.writes[0].value.questIds, [replacement.id, derived[1].id, derived[2].id])
})


test('quests and unfinished progress persist across midnight', () => {
    assert.deepEqual(pickDailyQuests('user-a', '2026-10-05'), pickDailyQuests('user-a', '2026-10-06'))
    const quests = pickDailyQuests('user-a', '2026-10-05')
    const result = applyQuestProgress(fakeTransaction(), {
        userId: 'user-a', dayKey: '2026-10-06',
        daySnap: snapshotOf({ questIds: quests.map((q) => q.id), progress: { [quests[0].id]: 1 } }),
        metric: 'unrelated',
    })
    assert.equal(result.quests[0].current, 1)
})

test('claim pays the completed quest and resets only its slot', () => {
    const quests = pickDailyQuests('user-a', '2026-10-05')
    const target = quests[0]
    const stored = { progress: { [target.id]: target.target, [quests[1].id]: 1 }, completed: { [target.id]: true } }
    const next = cycleQuest(stored, quests, target.id, `${target.id}:0`, () => 0)
    assert.deepEqual(next.reward, questRarityReward(target.rarity))
    assert.notEqual(next.nextQuests[0].id, target.id)
    assert.ok(!quests.slice(1).some((quest) => quest.id === next.nextQuests[0].id), 'the replacement is not already on the board')
    assert.equal(next.nextQuests.length, 3)
    assert.equal(next.progress[quests[1].id], 1)
    assert.equal(next.progress[next.nextQuests[0].id], undefined)
    assert.equal(next.completed[next.nextQuests[0].id], undefined)
    assert.equal(next.cycles[next.nextQuests[0].id], 1)
    assert.equal(stored.completed[target.id], true, 'source snapshot remains intact')
})

test('incomplete, removed, and stale quest claims are rejected', () => {
    const quests = pickDailyQuests('user-a', '2026-10-05')
    const target = quests[0]
    assert.throws(() => cycleQuest({}, quests, target.id, `${target.id}:0`), /Finish/)
    assert.throws(() => cycleQuest({}, quests, 'gone', 'gone:0'), /no longer/)
    const stored = { progress: { [target.id]: target.target }, completed: { [target.id]: true }, cycles: { [target.id]: 2 } }
    assert.throws(() => cycleQuest(stored, quests, target.id, `${target.id}:1`), /already been replaced/)
})

test('when a catalog quest returns in a later cycle its old claim token stays invalid', () => {
    const quests = [
        QUEST_CATALOG.find((q) => q.id === 'tasks-1'),
        ...pickDailyQuests('user-a', '2026-10-05').filter((quest) => quest.id !== 'tasks-1').slice(0, 2),
    ]
    const stored = { progress: { 'tasks-1': 1 }, completed: { 'tasks-1': true } }
    const first = cycleQuest(stored, quests, 'tasks-1', 'tasks-1:0', () => 0)
    const replacement = first.nextQuests[0]
    const secondStored = { ...first, progress: { [replacement.id]: replacement.target }, completed: { [replacement.id]: true } }

    // A replacement is drawn from the whole catalog minus the current board, so tasks-1 can only
    // come back once it is off the board - this hunts for the roll that brings it back.
    const roll = Array.from({ length: 1000 }, (_, index) => index / 1000).find((candidate) => (
        cycleQuest(secondStored, first.nextQuests, replacement.id, `${replacement.id}:1`, () => candidate).nextQuests[0].id === 'tasks-1'
    ))

    assert.ok(roll != null, 'expected a roll that hands tasks-1 back')

    const second = cycleQuest(secondStored, first.nextQuests, replacement.id, `${replacement.id}:1`, () => roll)
    assert.equal(second.nextQuests[0].id, 'tasks-1')
    assert.equal(second.cycles['tasks-1'], 1)
    assert.throws(() => cycleQuest(second, second.nextQuests, 'tasks-1', 'tasks-1:0'), /already been replaced/)
    assert.throws(() => cycleQuest(second, second.nextQuests, 'tasks-1', 'tasks-1:1'), /Finish/)
})
