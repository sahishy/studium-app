import { computeTotalElo } from '../leaderboards/leaderboardService.js'
import { createHash } from 'node:crypto'
import { db } from '../../lib/firebaseAdmin.js'
import { GRAND_QUEST_VERSION, grandQuestRound, grandQuestState } from './circlePolicy.js'
import { readMemberships, writeMembershipIndex } from './circleMemberships.js'
const idFor = text => createHash('sha256').update(text).digest('hex')
// Read all shared state before any caller starts writing. A shared context also
// accumulates contributions from multiple participants in the same transaction.
export const readCircleContexts = async (tx, userIds, { questInstances = [] } = {}) => {
    const memberships = await Promise.all([...new Set(userIds)].map(uid => readMemberships(tx, uid)))
    const circles = [...new Map(memberships.flatMap(m => m.circles).map(circle => [circle.id, circle])).values()]
    const contexts = await Promise.all(circles.map(async circle => {
        const goalRef=circle.ref.collection('goals').doc('grandQuest')
        const [members, goal, eligibleUsers] = await Promise.all([
            tx.get(circle.ref.collection('members')), tx.get(goalRef),
            tx.get(db.collection('users').where('primaryCircleId', '==', circle.id)),
        ])
        const memberIds = members.docs.map(m => m.id)
        const checked = new Set(questInstances.filter(q => memberIds.includes(q.userId))
            .map(q => idFor(`${q.userId}:${q.dayKey}:${q.instanceId}`)))
        const contributions = await Promise.all([...checked].map(id => tx.get(goalRef.collection('contributions').doc(id))))
        // Old Circles without an aggregate are repaired once. Normal events apply Elo
        // deltas rather than rereading every member's game statistics.
        const storedElo = circle.data().totalElo
        const stats = Number.isFinite(storedElo) ? [] : await Promise.all(members.docs.map(m => tx.get(db.collection('userStats').doc(m.id))))
        return { ref:circle.ref, snapshot:circle, checked, seen:new Set(contributions.filter(d=>d.exists).map(d=>d.id)), totalElo:Number.isFinite(storedElo) ? storedElo : stats.reduce((sum,snap)=>sum+computeTotalElo(snap.data()?.play),0), members:memberIds, eligible:eligibleUsers.docs.filter(u=>memberIds.includes(u.id)).map(u=>u.id), state:grandQuestState(circle.id,goal.data()) }
    }))
    contexts.memberships = memberships
    return contexts
}
// Call only after the caller has finished its reads.
export const writeCircleContextMigrations = (tx, contexts) => {
    if(contexts.migrationsWritten) return
    contexts.migrationsWritten = true
    for(const membership of contexts.memberships || []) writeMembershipIndex(tx, membership)
    for(const context of contexts) if(!Number.isFinite(context.snapshot.data().totalElo)) {
        tx.update(context.ref, { totalElo: context.totalElo })
    }
}
export const contributeQuests = (tx, contexts, {userId,dayKey,completed}) => {
    writeCircleContextMigrations(tx, contexts || [])
    if (!completed.length) return
    for (const context of contexts || []) {
        if (!context.members.includes(userId)) continue
        const {ref,seen} = context
        const fresh=completed.filter(quest=>{
            const id=idFor(`${userId}:${dayKey}:${quest.instanceId}`)
            if(!context.checked.has(id)) throw new Error('Quest contribution must be read before it is written.')
            if(seen.has(id))return false
            seen.add(id);return true
        })
        if(!fresh.length)continue
        for (const quest of fresh) {
            const id = idFor(`${userId}:${dayKey}:${quest.instanceId}`)
            seen.add(id)
            tx.set(ref.collection('goals').doc('grandQuest').collection('contributions').doc(id),{userId,dayKey,instanceId:quest.instanceId})
            tx.set(ref.collection('activity').doc(id), {type:'quest',userId,text:'Completed a quest',description:quest.label || quest.id,questId:quest.id,createdAt:new Date()})
        }
        advanceGrandQuest(tx, context, fresh.length)
    }
}

const advanceGrandQuest = (tx, context, amount) => {
    const { ref, state } = context
    state.count += amount
    state.roundProgress += amount
    while (state.roundProgress >= state.target) {
        const { cycle, target, reward } = state
        tx.create(ref.collection('grandQuestRounds').doc(String(cycle)), {
            cycle, target, reward, version: GRAND_QUEST_VERSION,
            eligible: [...context.eligible], completedAt: new Date(),
        })
        tx.set(ref.collection('activity').doc(`grand_goal_${cycle}`), { type: 'goal', text: 'Grand Quest complete!', createdAt: new Date() })
        state.roundProgress -= target
        state.cycle += 1
        Object.assign(state, grandQuestRound(ref.id, state.cycle))
    }
    tx.set(ref.collection('goals').doc('grandQuest'), { ...state, updatedAt: new Date() })
}

// Only first-time, rewarded Circle tasks contribute; the reward ledger prevents replay.
export const contributeCircleTask = (tx, contexts, { userId }) => {
    writeCircleContextMigrations(tx, contexts || [])
    for (const context of contexts || []) {
        if (context.members.includes(userId)) advanceGrandQuest(tx, context, 1)
    }
}
