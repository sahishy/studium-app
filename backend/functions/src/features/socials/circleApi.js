import { readCircleContexts } from './circleGoals.js'
import { computeTotalElo } from '../leaderboards/leaderboardService.js'
import { randomBytes, createHash } from 'node:crypto'
import { db } from '../../lib/firebaseAdmin.js'
import { readAccount, writeAccount } from '../economy/economyService.js'
import { CIRCLE_LIMIT, GRAND_QUEST_TARGET, GRAND_QUEST_REWARD, canClaimGrandQuest } from './circlePolicy.js'
import { RegExpMatcher, englishDataset, englishRecommendedTransformers, DataSet } from 'obscenity'
const matcher = new RegExpMatcher({ ...new DataSet().addAll(englishDataset).removePhrasesIf(p => p.metadata.originalWord === 'god').build(), ...englishRecommendedTransformers })
const validateIdentity = (profile) => {
    const title = String(profile?.title || '').trim(), flair = String(profile?.flair || '').trim()
    if (title.length < 3 || title.length > 30 || flair.length > 5 || matcher.hasMatch(title) || matcher.hasMatch(flair)) throw new Error('Choose an appropriate name (3–30 characters) and flair (up to 5 characters).')
    const banner = profile?.banner
    if (!banner || !/^#[0-9a-f]{8}$/i.test(banner.bgColor) || !/^#[0-9a-f]{6}$/i.test(banner.iconColor) || !Number.isInteger(banner.iconIndex) || banner.iconIndex < 0 || banner.iconIndex > 9) throw new Error('Invalid Circle banner.')
    return { title, flair, banner }
}
export const memberships = async (reader, uid) => {
    const circles = await reader.get(db.collection('circles'))
    const members = await Promise.all(circles.docs.map(c => reader.get(c.ref.collection('members').doc(uid))))
    return circles.docs.filter((c, i) => members[i].exists)
}
const totalElo = stats => computeTotalElo(stats?.play)
export const mutateMembership = async (uid, { action, circleId, profile }) => {
    const identity = action === 'create' ? validateIdentity(profile) : null
    const ref = action === 'create' ? db.collection('circles').doc() : db.collection('circles').doc(String(circleId))
    return db.runTransaction(async tx => {
        const userRef = db.collection('users').doc(uid)
        const [circle, member, user, stats, joined] = await Promise.all([tx.get(ref), tx.get(ref.collection('members').doc(uid)), tx.get(userRef), tx.get(db.collection('userStats').doc(uid)), memberships(tx, uid)])
        const existingMembers = await tx.get(ref.collection('members'))
        const memberStats = await Promise.all(existingMembers.docs.map(m=>tx.get(db.collection('userStats').doc(m.id))))
        const circleElo = memberStats.reduce((sum,snap)=>sum+totalElo(snap.data()),0)
        if (action === 'create' || action === 'join') {
            if (member.exists) return { circleId: ref.id }
            if (joined.length >= CIRCLE_LIMIT) throw new Error(`You can join up to ${CIRCLE_LIMIT} Circles.`)
            if (action === 'join' && !circle.exists) throw new Error('Circle not found.')
            const now = new Date()
            if (action === 'create') tx.create(ref, { profile: identity, inviteCode: randomBytes(8).toString('hex').toUpperCase(), memberCount: 1, totalElo: totalElo(stats.data()), level: 1, xp: 0, createdAt: now, updatedAt: now, createdByUserId: uid, createdBy: uid })
            else tx.update(ref, { memberCount: existingMembers.size + 1, totalElo: circleElo + totalElo(stats.data()), updatedAt: now })
            tx.create(ref.collection('members').doc(uid), { role: action === 'create' ? 'owner' : 'member', joinedAt: now })
        } else if (action === 'leave') {
            if (!member.exists) return { circleId: ref.id }
            tx.delete(member.ref)
            if (circle.exists) tx.update(ref, { memberCount: Math.max(0, existingMembers.size - 1), totalElo: Math.max(0, circleElo - totalElo(stats.data())) })
            if (user.data()?.primaryCircleId === ref.id) tx.update(userRef, { primaryCircleId: null })
        } else throw new Error('Unknown membership action.')
        return { circleId: ref.id }
    })
}
export const setPrimaryCircle = (uid, circleId) => db.runTransaction(async tx => {
    const member = circleId ? await tx.get(db.collection('circles').doc(String(circleId)).collection('members').doc(uid)) : null
    const circle=circleId ? await tx.get(db.collection('circles').doc(String(circleId))) : null
    if (circleId && (!member.exists || !circle.exists)) throw new Error('You must belong to this Circle.')
    tx.update(db.collection('users').doc(uid), { primaryCircleId: circleId || null })
    return { primaryCircleId: circleId || null }
})
export const editCircleIdentity = (uid, circleId, profile) => db.runTransaction(async tx => {
    const ref = db.collection('circles').doc(circleId), snap = await tx.get(ref)
    if (snap.data()?.createdByUserId !== uid) throw new Error('Unauthorized: only the owner can edit this Circle.')
    tx.update(ref, { profile: validateIdentity({ ...snap.data().profile, ...profile }), updatedAt: new Date() })
    return { ok: true }
})
export const circleActivity = async (uid, circleId, before) => {
    const ref = db.collection('circles').doc(circleId)
    const [member,circle] = await Promise.all([ref.collection('members').doc(uid).get(),ref.get()])
    if (!member.exists || !circle.exists) throw new Error('Unauthorized: join this Circle first.')
    const [goal, user, claim] = await Promise.all([ref.collection('goals').doc('grandQuest').get(), db.collection('users').doc(uid).get(), ref.collection('grandQuestClaims').doc(uid).get()])
    const lastClaimed = claim.data()?.cycle || 0
    const rounds = await ref.collection('grandQuestRounds').where('cycle', '>', lastClaimed).orderBy('cycle').get()
    const pending = rounds.docs.find(round => round.data().eligible.includes(uid))
    let query = ref.collection('activity').orderBy('createdAt', 'desc').orderBy('__name__', 'desc').limit(21)
    if (before) { const cursor = await ref.collection('activity').doc(String(before)).get(); if (cursor.exists) query = query.startAfter(cursor) }
    const events = await query.get()
    const count = Number(goal.data()?.count) || 0
    return { target: GRAND_QUEST_TARGET, reward: GRAND_QUEST_REWARD, count: pending ? GRAND_QUEST_TARGET : count % GRAND_QUEST_TARGET, claimCycle: pending?.data().cycle || null,
        canClaim: canClaimGrandQuest({ primaryCircleId: user.data()?.primaryCircleId, circleId, eligible: Boolean(pending), member: true, claimed: false }),
        events: events.docs.slice(0,20).filter(d => d.data().type !== 'task' || (d.data().circleId === circleId && d.data().xp > 0)).map(d => ({id:d.id,...d.data(),createdAt:d.data().createdAt.toDate().toISOString()})), nextCursor: events.size > 20 ? events.docs[19].id : null }
}
export const claimCircleGrandQuest = (uid, circleId, cycle) => db.runTransaction(async tx => {
    if (!Number.isSafeInteger(cycle) || cycle < 1) throw new Error('Choose a completed Grand Quest.')
    const ref = db.collection('circles').doc(circleId), claimRef = ref.collection('grandQuestClaims').doc(uid)
    const [account, member, claim, circle] = await Promise.all([readAccount(tx,uid), tx.get(ref.collection('members').doc(uid)), tx.get(claimRef), tx.get(ref)])
    if (!member.exists || !circle.exists) throw new Error('Unauthorized: join this Circle first.')
    if (cycle <= (claim.data()?.cycle || 0)) return { reward: { xp: 0, lumen: 0 }, alreadyClaimed: true }
    const rounds = await tx.get(ref.collection('grandQuestRounds').where('cycle', '>', claim.data()?.cycle || 0).orderBy('cycle'))
    const pending = rounds.docs.find(round => round.data().eligible.includes(uid))
    if (!canClaimGrandQuest({ primaryCircleId: account.user.primaryCircleId, circleId, eligible: pending?.data().cycle === cycle, member: true, claimed: false })) throw new Error('This Grand Quest reward is not available from your primary Circle.')
    tx.set(claimRef, { userId: uid, cycle, claimedAt: new Date() })
    return { ...writeAccount(tx,account,GRAND_QUEST_REWARD), reward: GRAND_QUEST_REWARD }
})
export const contributionId = value => createHash('sha256').update(value).digest('hex')

export const listJoinedCircles = uid => db.runTransaction(async tx => {
    const contexts=await readCircleContexts(tx,[uid])
    const snapshots=await Promise.all(contexts.map(c=>tx.get(c.ref)))
    for(const context of contexts)tx.update(context.ref,{totalElo:context.totalElo,memberCount:context.members.length})
    return {circles:contexts.map((c,index)=>({uid:c.ref.id,...snapshots[index].data(),totalElo:c.totalElo,memberCount:c.members.length}))}
})
