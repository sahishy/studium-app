import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'

test('continuous quests claim rewards once under concurrent requests and preserve other slots', { skip: process.env.USE_FIREBASE_EMULATORS !== 'true' }, async () => {
    const { db } = await import('../../lib/firebaseAdmin.js')
    const { claimQuest, getQuestBoard, recordQuestEvent, rerollQuest } = await import('./questService.js')
    const userId = `quest_test_${randomUUID()}`
    const userRef = db.collection('users').doc(userId)
    const boardRef = db.collection('questBoards').doc(userId)
    const walletRef = db.collection('wallets').doc(userId)
    try {
        await userRef.set({ progress: { level: 1, xp: 0, timeZone: 'America/New_York' } })
        await boardRef.set({ userId, questIds: ['tasks-12', 'win-1', 'hearts-1'], progress: { 'win-1': 0 }, completed: {}, rerollDay: '2000-01-01', rerollsUsed: 1 })
        const completion = await recordQuestEvent(userId, 'task_completed', { amount: 12 })
        assert.deepEqual(completion.reward, { xp: 0, lumen: 0, crates: 0 })
        assert.equal(completion.wallet.balance, 0)
        assert.equal(completion.progress.xp, 0)
        const board = await getQuestBoard(userId)
        assert.equal(board.rerollsRemaining, 1, 'only rerolls reset at midnight')
        const quest = board.quests[0]
        assert.equal(quest.completed, true)
        const results = await Promise.allSettled([
            claimQuest(userId, quest.id, quest.instanceId),
            claimQuest(userId, quest.id, quest.instanceId),
        ])
        assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
        const payout = results.find((result) => result.status === 'fulfilled').value
        assert.deepEqual(payout.reward, { xp: 80, lumen: 40, crates: 2 })
        assert.equal((await walletRef.get()).data().balance, 40)
        assert.equal((await walletRef.get()).data().crateTokens, 2)
        const next = await getQuestBoard(userId)
        assert.notEqual(next.quests[0].instanceId, quest.instanceId)
        assert.equal(next.quests[0].current, 0)
        assert.equal(next.quests[0].completed, false)
        assert.deepEqual(next.quests.slice(1), board.quests.slice(1))
        const rerolled = await rerollQuest(userId, next.quests[1].id)
        assert.equal(rerolled.rerollsRemaining, 0)
        await assert.rejects(() => rerollQuest(userId, rerolled.quests[1].id), /No rerolls/)
        assert.equal((await getQuestBoard(userId)).rerollsRemaining, 0)
    } finally {
        await Promise.all([userRef, boardRef, walletRef].map((ref) => ref.delete()))
    }
})

test('migration keeps unfinished daily work and does not pay previously rewarded completions twice', { skip: process.env.USE_FIREBASE_EMULATORS !== 'true' }, async () => {
    const { db } = await import('../../lib/firebaseAdmin.js')
    const { localDayKey } = await import('../economy/progression.js')
    const { claimQuest, getQuestBoard } = await import('./questService.js')
    const userId = `quest_migration_${randomUUID()}`
    const userRef = db.collection('users').doc(userId)
    const legacyRef = db.collection('questDays').doc(`${userId}_${localDayKey(new Date(), 'America/New_York')}`)
    const boardRef = db.collection('questBoards').doc(userId)
    try {
        await userRef.set({ progress: { level: 1, xp: 0, timeZone: 'America/New_York' } })
        await legacyRef.set({ questIds: ['tasks-3', 'win-1', 'hearts-1'], progress: { 'tasks-3': 2, 'hearts-1': 1 }, completed: { 'hearts-1': true }, rerollsUsed: 1 })
        const board = await getQuestBoard(userId)
        assert.equal(board.quests[0].current, 2)
        assert.equal(board.quests[2].current, 0)
        assert.equal(board.quests[2].completed, false)
        assert.equal(board.rerollsRemaining, 0)
        await assert.rejects(() => claimQuest(userId, 'hearts-1', 'hearts-1:0'), /already been replaced/)
        await assert.rejects(() => claimQuest(userId, 'hearts-1', 'hearts-1:1'), /Finish/)
        assert.deepEqual((await getQuestBoard(userId)).quests, board.quests)
    } finally {
        await Promise.all([userRef, legacyRef, boardRef].map((ref) => ref.delete()))
    }
})
