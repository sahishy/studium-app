import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'

const options = { skip: process.env.USE_FIREBASE_EMULATORS !== 'true' }

test('daily task counter migrates without replenishing rewards, caps concurrent completions, and rolls over', options, async () => {
    const { db } = await import('../../lib/firebaseAdmin.js')
    const { setTaskStatus } = await import('../tasks/taskStatusService.js')
    const { localDayKey } = await import('./progression.js')
    const uid = `optimization_cap_${randomUUID()}`
    const user = db.collection('users').doc(uid), wallet = db.collection('wallets').doc(uid)
    const board = db.collection('questBoards').doc(uid)
    const dayKey = localDayKey(new Date(), 'UTC')
    const legacy = db.collection('taskRewardDays').doc(`${uid}_${dayKey}`)
    const tasks = Array.from({ length: 4 }, (_, i) => db.collection('tasks').doc(`${uid}_${i}`))
    try {
        await user.set({ progress: { level: 1, xp: 0, curveVersion: 3 }, circleMemberships: { version: 1, ids: [] } })
        await legacy.set({ userId: uid, dayKey, count: 4 })
        await board.set({ questIds: ['win-1', 'hearts-1', 'matches-1'] })
        await Promise.all(tasks.map(ref=>ref.set({ userId: uid, status: 'Incomplete', alreadyCompleted: false })))
        const results = await Promise.all(tasks.slice(0,3).map(ref=>setTaskStatus({ userId: uid, taskId: ref.id, status: 'Completed' })))
        assert.equal(results.reduce((sum,r)=>sum+r.xp,0), 5, 'only the one remaining daily slot pays')
        assert.deepEqual((await wallet.get()).data().taskRewards, { version: 1, dayKey, count: 5 })
        assert.equal((await legacy.get()).data().count, 4, 'legacy documents stop receiving writes')
        await tasks[0].delete()
        await tasks[0].set({ userId: uid, status: 'Incomplete', alreadyCompleted: false })
        await wallet.update({ taskRewards: { version: 1, dayKey: '2000-01-01', count: 5 } })
        assert.equal((await setTaskStatus({ userId: uid, taskId: tasks[0].id, status: 'Completed' })).xp, 0, 'recreated IDs cannot receive a second reward')
        assert.equal((await setTaskStatus({ userId: uid, taskId: tasks[3].id, status: 'Completed' })).xp, 5, 'a new day starts with a fresh allowance')
        assert.equal((await wallet.get()).data().taskRewards.count, 1)
    } finally {
        await Promise.all([user, wallet, board, legacy, ...tasks, ...tasks.map(ref=>db.collection('rewardEvents').doc(`task_${ref.id}`))].map(ref=>ref.delete()))
    }
})

test('unchanged account operations do not write, and XP-only grants leave the wallet untouched', options, async () => {
    const { db } = await import('../../lib/firebaseAdmin.js')
    const { getEconomySnapshot, readAccount, writeAccount } = await import('./economyService.js')
    const uid = `optimization_writes_${randomUUID()}`
    const user = db.collection('users').doc(uid), wallet = db.collection('wallets').doc(uid)
    try {
        await user.set({ progress: { level: 1, xp: 0, curveVersion: 3 } })
        await getEconomySnapshot(uid)
        for(const xp of [0, 5]) {
            const paths = await db.runTransaction(async tx=>{
                const account = await readAccount(tx, uid), paths = []
                const recorder = { set: (ref, ...args)=>{ paths.push(ref.path); return tx.set(ref,...args) } }
                writeAccount(recorder, account, { xp })
                return paths
            })
            assert.deepEqual(paths, xp ? [user.path] : [])
        }
    } finally { await Promise.all([user.delete(), wallet.delete()]) }
})

test('concurrent streak claims pay once and return their persisted claim state', options, async () => {
    const { db } = await import('../../lib/firebaseAdmin.js')
    const { claimStreakReward, getStreakBoard } = await import('../progress/streakService.js')
    const uid = `optimization_streak_${randomUUID()}`
    const user=db.collection('users').doc(uid), wallet=db.collection('wallets').doc(uid)
    try {
        await user.set({ progress: { level: 1, xp: 0, curveVersion: 3, streak: 0 } })
        const results=await Promise.allSettled(Array.from({length:4},()=>claimStreakReward(uid)))
        const successful=results.filter(r=>r.status==='fulfilled')
        assert.equal(successful.length,1)
        assert.equal((await wallet.get()).data().balance,5)
        assert.equal(successful[0].value.wallet.lastStreakClaim.dayKey,successful[0].value.dayKey)
        assert.equal((await getStreakBoard(uid)).claimedToday,true)
        assert.equal((await user.get()).data().progress.lastStreakClaimDay,undefined,'claim state only lives in the wallet')
    } finally { await Promise.all([user.delete(),wallet.delete()]) }
})

test('compact crate receipts replay the same drop and tips normalize amounts and bind receipt IDs', options, async () => {
    const { db } = await import('../../lib/firebaseAdmin.js')
    const { openCrate, tipResource } = await import('./economyService.js')
    const uid = `optimization_receipts_${randomUUID()}`, other = `${uid}_recipient`, op = randomUUID()
    const users = [uid,other].map(id=>db.collection('users').doc(id))
    const wallets = [uid,other].map(id=>db.collection('wallets').doc(id))
    const resource = db.collection('resources').doc(uid)
    const crateOp = db.collection('economyOps').doc(`${uid}_crate_${op}`)
    const tipOp = db.collection('economyOps').doc(`${uid}_tip_${op}`)
    try {
        await Promise.all(users.map(ref=>ref.set({ progress: { level: 1, xp: 0, curveVersion: 3 } })))
        await wallets[0].set({ balance: 100, crateTokens: 1, inventory: [] })
        await wallets[1].set({ balance: 5 })
        await resource.set({ ownerId: other, status: 'published' })
        const crate = await openCrate(uid, op)
        assert.equal((await crateOp.get()).data().result.wallet, undefined)
        const tip = await tipResource(uid, resource.id, '10', op)
        assert.equal((await wallets[1].get()).data().balance, 15, 'numeric strings never concatenate with balances')
        assert.deepEqual(await tipResource(uid, resource.id, 10, op), tip)
        await assert.rejects(tipResource(uid, resource.id, 25, op), /different tip/)
        const replay = await openCrate(uid, op)
        assert.deepEqual(replay.color, crate.color)
        assert.deepEqual(replay.rarityPath, crate.rarityPath)
        assert.equal(replay.wallet.balance, 90, 'replay returns the current wallet without another charge')
        assert.equal(replay.wallet.crateTokens, 0)
    } finally { await Promise.all([...users,...wallets,resource,crateOp,tipOp].map(ref=>ref.delete())) }
})

test('Circle indexes migrate, survive concurrent joins, and bound contribution receipt reads', options, async () => {
    const { db } = await import('../../lib/firebaseAdmin.js')
    const { mutateMembership, listJoinedCircles } = await import('../socials/circleApi.js')
    const { readCircleContexts, contributeQuests } = await import('../socials/circleGoals.js')
    const uid = `optimization_circles_${randomUUID()}`
    const user = db.collection('users').doc(uid)
    const circles = Array.from({ length: 3 },(_,i)=>db.collection('circles').doc(`${uid}_${i}`))
    try {
        await user.set({ progress: { level: 1, xp: 0 }, primaryCircleId: circles[0].id })
        await Promise.all(circles.map(ref=>ref.set({ totalElo: 0, memberCount: 0 })))
        await circles[0].collection('members').doc(uid).set({ role: 'member' })
        assert.equal((await listJoinedCircles(uid)).circles.length, 1)
        assert.deepEqual((await user.get()).data().circleMemberships.ids, [circles[0].id])
        await Promise.all(circles.slice(1).map(ref=>mutateMembership(uid,{action:'join',circleId:ref.id})))
        assert.equal((await listJoinedCircles(uid)).circles.length, 3, 'concurrent joins preserve both index entries')
        const history = circles[0].collection('goals').doc('grandQuest').collection('contributions')
        await Promise.all(Array.from({length:25},(_,i)=>history.doc(`old_${i}`).set({userId:uid})))
        const completed = [{ id: 'tasks-1', instanceId: 'tasks-1:0' }], dayKey = '2026-10-14'
        for(let repeat=0;repeat<2;repeat++) {
            const paths = await db.runTransaction(async tx=>{
                const paths = []
                const reader = { get: ref=>{ paths.push(ref.path); return tx.get(ref) } }
                const contexts = await readCircleContexts(reader,[uid],{questInstances:completed.map(q=>({userId:uid,dayKey,instanceId:q.instanceId}))})
                contributeQuests(tx,contexts,{userId:uid,dayKey,completed})
                return paths
            })
            assert.ok(!paths.includes('circles'), 'indexed users never scan all Circles')
            assert.ok(!paths.some(path=>path?.endsWith('/contributions')), 'history is never scanned')
            assert.equal(paths.filter(path=>path?.includes('/contributions/')).length, 3, 'one candidate receipt per joined Circle')
            assert.ok(!paths.some(path=>path?.startsWith('userStats/')), 'stored Elo avoids per-member statistics reads')
        }
        for(const ref of circles) assert.equal((await ref.collection('goals').doc('grandQuest').get()).data().count, 1)
        await mutateMembership(uid,{action:'leave',circleId:circles[1].id})
        assert.equal((await listJoinedCircles(uid)).circles.length,2)
        await db.recursiveDelete(circles[2])
        assert.equal((await listJoinedCircles(uid)).circles.length,1, 'stale index entries cannot restore deleted membership')
    } finally {
        await Promise.all(circles.map(ref=>db.recursiveDelete(ref)))
        await user.delete()
    }
})
