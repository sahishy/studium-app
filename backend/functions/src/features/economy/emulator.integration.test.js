import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'

test('local emulators: nested task rewards, cap, deletion, crates, tips, hearts, anonymous posts, and bot results', { skip: process.env.USE_FIREBASE_EMULATORS !== 'true' }, async () => {
    const { db } = await import('../../lib/firebaseAdmin.js')
    const { localDayKey } = await import('./progression.js')
    const { COSMETIC_CATALOG, openCrate } = await import('./economyService.js')
    const { reconcileTaskTree, setTaskStatus } = await import('../tasks/taskStatusService.js')
    const { saveRealtimeResult } = await import('../realtime/realtimeService.js')
    const { listCollegePosts, saveCollegePost, saveResource, toggleHeart } = await import('../resources/contentService.js')
    const prefix = `codex_${randomUUID().replaceAll('-', '')}`
    const first = `${prefix}_first`
    const second = `${prefix}_second`
    const circleId = `${prefix}_circle`
    const gameId = `${prefix}_game`
    const taskIds = ['root', 'child1', 'child2', 'deleteRoot', 'deleteChild', 'reconcileRoot', 'reconcileDone', 'reconcileRemoved', 'circleTask', 'standalone1', 'standalone2', 'standalone3'].map((value) => `${prefix}_${value}`)
    const [rootId, firstChildId, secondChildId, deleteRootId, deleteChildId, reconcileRootId, reconcileDoneId, reconcileRemovedId, circleTaskId, ...standaloneIds] = taskIds
    const refs = [
        ...[first, second].flatMap((id) => [db.collection('users').doc(id), db.collection('wallets').doc(id), db.collection('userStats').doc(id), db.collection('questBoards').doc(id)]),
        db.collection('circles').doc(circleId), db.collection('gameResults').doc(gameId),
        ...taskIds.map((id) => db.collection('tasks').doc(id)),
        ...taskIds.map((id) => db.collection('rewardEvents').doc(`task_${id}`)),
        db.collection('rewardEvents').doc(`match_${gameId}_${first}`),
        db.collection('taskRewardDays').doc(`${first}_${localDayKey(new Date(), 'America/New_York')}`),
        db.collection('economyOps').doc(`${first}_crate_${prefix}_crate`),
        db.collection('economyOps').doc(`${first}_tip_${prefix}_tip`),
    ]
    const title = { segments: [{ type: 'text', rawText: 'Test task', displayText: 'Test task' }] }
    const task = (id, parentTaskId = null, ownerId = first, extra = {}) => db.collection('tasks').doc(id).set({ title, userId: ownerId, parentTaskId, circleId: null, status: 'Incomplete', alreadyCompleted: false, createdAt: new Date(), ...extra })
    try {
        await Promise.all([first, second].map((id) => db.collection('users').doc(id).set({ profile: { displayName: id, avatar: { color: '#fcd34d', face: 0 } }, progress: { level: 1, xp: 0, tasksCompleted: 0, timeZone: 'America/New_York' }, preferences: { agenda: { list: { completionBehavior: 'keep' } } } })))
        await task(rootId)
        await Promise.all([task(firstChildId, rootId), task(secondChildId, rootId)])
        const firstReward = await setTaskStatus({ userId: first, taskId: firstChildId, status: 'Completed' })
        assert.equal(firstReward.xp, 5)
        assert.equal(firstReward.statuses[rootId], 'In Progress')
        assert.equal((await setTaskStatus({ userId: first, taskId: firstChildId, status: 'Completed' })).xp, 0)
        await setTaskStatus({ userId: first, taskId: firstChildId, status: 'Incomplete' })
        assert.equal((await setTaskStatus({ userId: first, taskId: firstChildId, status: 'Completed' })).xp, 0)
        const secondReward = await setTaskStatus({ userId: first, taskId: secondChildId, status: 'Completed' })
        assert.equal(secondReward.xp, 5)
        assert.equal(secondReward.statuses[rootId], 'Completed')
        assert.equal((await db.collection('rewardEvents').doc(`task_${rootId}`).get()).exists, false)

        await db.collection('users').doc(first).update({ 'preferences.agenda.list.completionBehavior': 'delete' })
        await task(deleteRootId)
        await task(deleteChildId, deleteRootId)
        const deleted = await setTaskStatus({ userId: first, taskId: deleteChildId, status: 'Completed' })
        assert.equal(deleted.deleted, true)
        assert.equal((await db.collection('tasks').doc(deleteRootId).get()).exists, false)
        assert.equal((await db.collection('rewardEvents').doc(`task_${deleteChildId}`).get()).exists, true)
        await db.collection('users').doc(first).update({ 'preferences.agenda.list.completionBehavior': 'keep' })

        await db.collection('circles').doc(circleId).set({ xp: 0, createdByUserId: second })
        await db.collection('circles').doc(circleId).collection('members').doc(first).set({ userId: first })
        await task(circleTaskId, null, second, { circleId })
        assert.equal((await setTaskStatus({ userId: first, taskId: circleTaskId, status: 'Completed' })).xp, 5)
        assert.equal((await db.collection('circles').doc(circleId).get()).data().xp, 5)
        for(const id of standaloneIds) await task(id)
        const lastRewards = []
        for(const id of standaloneIds) lastRewards.push(await setTaskStatus({ userId: first, taskId: id, status: 'Completed' }))
        assert.deepEqual(lastRewards.map((value) => value.xp), [5, 0, 0])
        assert.equal(lastRewards.at(-1).dayCount, 5)

        await task(reconcileRootId)
        await Promise.all([task(reconcileDoneId, reconcileRootId), task(reconcileRemovedId, reconcileRootId)])
        await setTaskStatus({ userId: first, taskId: reconcileDoneId, status: 'Completed' })
        await db.collection('users').doc(first).update({ 'preferences.agenda.list.completionBehavior': 'delete' })
        await db.collection('tasks').doc(reconcileRemovedId).delete()
        const reconciled = await reconcileTaskTree({ userId: first, taskId: reconcileRootId })
        assert.equal(reconciled.deleted, true)
        assert.deepEqual(new Set(reconciled.deletedIds), new Set([reconcileRootId, reconcileDoneId]))
        assert.equal((await db.collection('tasks').doc(reconcileRootId).get()).exists, false)
        assert.equal((await db.collection('rewardEvents').doc(`task_${reconcileDoneId}`).get()).exists, true)
        await db.collection('users').doc(first).update({ 'preferences.agenda.list.completionBehavior': 'keep' })

        await db.collection('wallets').doc(first).set({ balance: 100, crateTokens: 0, milestonesGranted: 0, inventory: COSMETIC_CATALOG.map((item) => item.id) })
        const crate = await openCrate(first, `${prefix}_crate`)
        assert.equal(crate.duplicate, true)
        assert.equal(crate.refund, 50)
        assert.equal(crate.wallet.balance, 50)
        assert.deepEqual(await openCrate(first, `${prefix}_crate`), crate)

        const resource = await saveResource(second, { type: 'link', title: 'Reference', description: '', subject: '', status: 'published', linkType: 'website', url: 'https://example.org' })
        refs.push(db.collection('resources').doc(resource.id))
        const heartAdded = await toggleHeart(first, resource.id)
        assert.equal(heartAdded.active, true)
        assert.equal(heartAdded.count, 1)
        const heartRemoved = await toggleHeart(first, resource.id)
        assert.equal(heartRemoved.active, false)
        assert.equal(heartRemoved.count, 0)
        const { tipResource } = await import('./economyService.js')
        const tip = await tipResource(first, resource.id, 10, `${prefix}_tip`)
        assert.equal(tip.balance, 40)
        assert.deepEqual(await tipResource(first, resource.id, 10, `${prefix}_tip`), tip)
        await assert.rejects(() => tipResource(second, resource.id, 10, `${prefix}_self_tip`))

        const college = await saveCollegePost(first, { college: 'Example University', year: 2026, outcome: 'accepted', attributed: false })
        refs.push(db.collection('collegePosts').doc(college.id))
        const publicPost = (await listCollegePosts(second)).find((post) => post.id === college.id)
        assert.equal(publicPost.ownerId, undefined)
        assert.equal(publicPost.attributed, false)

        const result = { gameId, modeId: 'sat-classic', ranked: true, playerIds: [first, 'bot'], botPlayerIds: ['bot'], winnerUserId: 'bot', roundsPlayed: 2, endReason: 'max_questions', participationByUserId: { [first]: 2 }, startedAt: Date.now() - 120000, endedAt: Date.now() }
        const saved = await saveRealtimeResult(result)
        assert.deepEqual(saved.rewardsByUserId[first], { xp: 25, lumen: 10 })
        assert.equal((await saveRealtimeResult(result)).duplicate, true)
        assert.equal((await db.collection('rewardEvents').doc(`match_${gameId}_${first}`).get()).exists, false, 'match results are the sole reward receipt')
    } finally {
        await Promise.allSettled(refs.map((ref) => db.recursiveDelete(ref)))
    }
})
