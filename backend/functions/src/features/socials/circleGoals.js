import { computeTotalElo } from '../leaderboards/leaderboardService.js'
import { createHash } from 'node:crypto'
import { db } from '../../lib/firebaseAdmin.js'
import { GRAND_QUEST_TARGET } from './circlePolicy.js'
const idFor = text => createHash('sha256').update(text).digest('hex')
// Read all shared state before any caller starts writing. A shared context also
// accumulates contributions from multiple participants in the same transaction.
export const readCircleContexts = async (tx, userIds) => {
    const circles = await tx.get(db.collection('circles'))
    const checks=await Promise.all(circles.docs.map(async circle=>({circle,joined:(await Promise.all(userIds.map(uid=>tx.get(circle.ref.collection('members').doc(uid))))).some(member=>member.exists)})))
    const contexts = await Promise.all(checks.filter(check=>check.joined).map(async ({circle}) => {
        const goalRef=circle.ref.collection('goals').doc('grandQuest')
        const [members, goal, contributions] = await Promise.all([tx.get(circle.ref.collection('members')), tx.get(goalRef), tx.get(goalRef.collection('contributions'))])
        const stats = await Promise.all(members.docs.map(m => tx.get(db.collection('userStats').doc(m.id))))
        return { ref:circle.ref, seen:new Set(contributions.docs.map(d=>d.id)), totalElo: stats.reduce((sum,snap)=>sum+computeTotalElo(snap.data()?.play),0), members:members.docs.map(m => m.id), state:{count:0,...goal.data()} }
    }))
    return contexts.filter(c => userIds.some(uid => c.members.includes(uid)))
}
export const contributeQuests = (tx, contexts, {userId,dayKey,completed}) => {
    if (!completed.length) return
    for (const context of contexts || []) {
        if (!context.members.includes(userId)) continue
        const {ref,state,seen} = context
        const fresh=completed.filter(quest=>{
            const id=idFor(`${userId}:${dayKey}:${quest.instanceId}`)
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
        const before = state.count
        state.count += fresh.length
        // Progress rolls into the next round immediately; each finished round keeps
        // its own eligibility so a member can claim without holding everyone up.
        for (let cycle = Math.floor(before / GRAND_QUEST_TARGET) + 1; cycle <= Math.floor(state.count / GRAND_QUEST_TARGET); cycle++) {
            tx.create(ref.collection('grandQuestRounds').doc(String(cycle)), { cycle, eligible: [...context.members], completedAt: new Date() })
            tx.set(ref.collection('activity').doc(`grand_goal_${cycle}`), { type: 'goal', text: 'Grand Quest complete!', createdAt: new Date() })
        }
        tx.set(ref.collection('goals').doc('grandQuest'), { ...state, updatedAt: new Date() })
    }
}
