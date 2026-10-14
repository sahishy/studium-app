import { readCircleContexts } from '../socials/circleGoals.js'
import { db } from '../../lib/firebaseAdmin.js'
import { FieldValue } from 'firebase-admin/firestore'
import { readAccount, writeAccount } from '../economy/economyService.js'
import { grantXp, localDayKey, TASK_DAILY_LIMIT, TASK_XP } from '../economy/progression.js'
import { applyQuestProgress, questDayRef } from '../quests/questService.js'

const VALID_STATUSES = new Set(['Incomplete', 'In Progress', 'Completed'])
const circleIdOf = (task) => task?.circleId || task?.title?.segments?.find((segment) => segment?.widgetType === 'circle')?.value?.circleId || null

const deriveParentStatus = (children) => {
    if(children.every((child) => child.status === 'Completed')) return 'Completed'
    if(children.every((child) => child.status === 'Incomplete')) return 'Incomplete'
    return 'In Progress'
}

const loadTaskTree = async (transaction, taskRef) => {
    const targetSnap = await transaction.get(taskRef)
    if(!targetSnap.exists) throw new Error('Task not found.')
    const ancestors = []
    let current = { uid: targetSnap.id, ...targetSnap.data() }
    const seen = new Set([current.uid])
    while(current.parentTaskId) {
        if(seen.has(current.parentTaskId)) throw new Error('Invalid task hierarchy.')
        seen.add(current.parentTaskId)
        const parentSnap = await transaction.get(db.collection('tasks').doc(current.parentTaskId))
        if(!parentSnap.exists) break
        current = { uid: parentSnap.id, ...parentSnap.data() }
        ancestors.push(current)
    }
    const root = current
    const byId = new Map([[root.uid, root]])
    const childrenById = new Map()
    let frontier = [root]
    while(frontier.length) {
        const batches = await Promise.all(frontier.map((node) => transaction.get(db.collection('tasks').where('parentTaskId', '==', node.uid))))
        const next = []
        batches.forEach((snap, index) => {
            const children = snap.docs.map((doc) => ({ uid: doc.id, ...doc.data() }))
            childrenById.set(frontier[index].uid, children)
            children.forEach((child) => {
                if(byId.has(child.uid)) throw new Error('Invalid task hierarchy.')
                byId.set(child.uid, child)
                next.push(child)
            })
        })
        frontier = next
        if(byId.size > 250) throw new Error('Task group is too large.')
    }
    return { target: { uid: targetSnap.id, ...targetSnap.data() }, root, byId, childrenById, ancestors }
}

const setTaskStatus = async ({ userId, taskId, status, timeZone = 'UTC' }) => {
    if(!VALID_STATUSES.has(status)) throw new Error('Invalid task status.')
    if(!taskId || typeof taskId !== 'string') throw new Error('Task ID required.')
    return db.runTransaction(async (transaction) => {
        const tree = await loadTaskTree(transaction, db.collection('tasks').doc(taskId))
        const circleId = circleIdOf(tree.root)
        if(circleId) {
            const member = await transaction.get(db.collection('circles').doc(circleId).collection('members').doc(userId))
            if(!member.exists) throw new Error('You cannot edit this task.')
        } else if(tree.root.userId !== userId || tree.target.userId !== userId) {
            throw new Error('You cannot edit this task.')
        }
        const targetChildren = tree.childrenById.get(taskId) || []
        if(targetChildren.length) throw new Error('Complete the subtasks to change this parent.')

        const account = await readAccount(transaction, userId)
        const candidateZone = account.user.preferences?.timeZone || account.progress.timeZone || timeZone
        let savedZone = 'UTC'
        try { new Intl.DateTimeFormat('en', { timeZone: candidateZone }).format(); savedZone = candidateZone } catch { /* use UTC */ }
        const dayKey = localDayKey(new Date(), savedZone)
        const dayRef = db.collection('taskRewardDays').doc(`${userId}_${dayKey}`)
        const eventRef = db.collection('rewardEvents').doc(`task_${taskId}`)
        const questRef = questDayRef(userId, dayKey)
        const [daySnap, eventSnap, questSnap] = await Promise.all([
            transaction.get(dayRef),
            transaction.get(eventRef),
            transaction.get(questRef),
        ])
        const circleContexts = await readCircleContexts(transaction, [userId])
        const previousStatus = tree.target.status || 'Incomplete'
        const firstCompletion = status === 'Completed' && previousStatus !== 'Completed' && !eventSnap.exists && !tree.target.alreadyCompleted && !tree.target.tutorialRunId
        const used = Math.min(TASK_DAILY_LIMIT, Number(daySnap.data()?.count) || 0)
        const xp = firstCompletion && used < TASK_DAILY_LIMIT ? TASK_XP : 0
        const nextCount = used + (xp > 0 ? 1 : 0)

        const statuses = new Map([[taskId, status]])
        for(const ancestor of tree.ancestors) {
            const children = (tree.childrenById.get(ancestor.uid) || []).map((child) => ({ ...child, status: statuses.get(child.uid) || child.status }))
            statuses.set(ancestor.uid, deriveParentStatus(children))
        }
        const rootStatus = statuses.get(tree.root.uid) || tree.root.status
        const shouldDelete = status === 'Completed' && rootStatus === 'Completed' && account.user?.preferences?.agenda?.list?.completionBehavior === 'delete'

        if(shouldDelete) {
            for(const node of tree.byId.values()) transaction.delete(db.collection('tasks').doc(node.uid))
        } else {
            for(const [id, nextStatus] of statuses) {
                const original = tree.byId.get(id)
                if(original?.status !== nextStatus) transaction.update(db.collection('tasks').doc(id), { status: nextStatus, updatedAt: new Date(), ...(id === taskId && status === 'Completed' ? { alreadyCompleted: true } : {}) })
            }
            if(firstCompletion && previousStatus === status) transaction.update(db.collection('tasks').doc(taskId), { alreadyCompleted: true })
        }
        if(firstCompletion) {
            transaction.create(eventRef, { userId, taskId, type: 'task', xp, dayKey, createdAt: new Date() })
            if (circleId && xp > 0) {
                const title = tree.target.title
                const description = typeof title === 'string' ? title : (title?.segments || []).map(segment => segment.rawText || segment.text || '').join('')
                for (const context of circleContexts.filter(context => context.ref.id === circleId)) {
                    transaction.set(context.ref.collection('activity').doc(`reward_task_${taskId}`), {
                        type: 'task', userId, taskId, circleId, text: 'Completed a task', description, xp, createdAt: new Date(),
                    })
                }
            }
        }
        // Quests count every genuine first completion, even past the five daily XP slots.
        const quests = firstCompletion
            ? applyQuestProgress(transaction, { userId, dayKey, daySnap: questSnap, metric: 'task_completed', circleContexts })
            : { reward: { xp: 0, lumen: 0, crates: 0 }, completed: [], quests: [] }
        const { progress, wallet } = writeAccount(transaction, {
            ...account,
            progress: { ...account.progress, timeZone: savedZone, tasksCompleted: (Number(account.progress.tasksCompleted) || 0) + (firstCompletion ? 1 : 0) },
        }, { xp: xp + quests.reward.xp, lumen: quests.reward.lumen, crates: quests.reward.crates ?? 0, counter: xp ? 'rewardedTasks' : null })
        if(xp) transaction.set(dayRef, { userId, dayKey, count: nextCount, updatedAt: new Date() }, { merge: true })
        if(circleId && xp) {
            const circleRef = db.collection('circles').doc(circleId)
            // Circle rewards remain separate from the student's five daily personal XP slots.
            // The circle value is incremented only for an eligible, first-time completion.
            transaction.update(circleRef, { xp: FieldValue.increment(xp) })
        }
        return { status, changed: previousStatus !== status, deleted: shouldDelete, deletedIds: shouldDelete ? [...tree.byId.keys()] : [], xp, dayCount: nextCount, dayLimit: TASK_DAILY_LIMIT, progress, wallet, statuses: Object.fromEntries(statuses), quests: quests.quests, questsCompleted: quests.completed, questReward: quests.reward }
    })
}

const reconcileTaskTree = async ({ userId, taskId }) => db.runTransaction(async (transaction) => {
    const tree = await loadTaskTree(transaction, db.collection('tasks').doc(taskId))
    const circleId = circleIdOf(tree.root)
    if(circleId) {
        const member = await transaction.get(db.collection('circles').doc(circleId).collection('members').doc(userId))
        if(!member.exists) throw new Error('You cannot edit this task.')
    } else if(tree.root.userId !== userId) throw new Error('You cannot edit this task.')

    const statuses = new Map()
    const visit = (node) => {
        const children = tree.childrenById.get(node.uid) || []
        const status = children.length
            ? deriveParentStatus(children.map((child) => ({ ...child, status: visit(child) })))
            : node.status || 'Incomplete'
        statuses.set(node.uid, status)
        return status
    }
    visit(tree.root)
    const account = await readAccount(transaction, userId)
    const shouldDelete = statuses.get(tree.root.uid) === 'Completed' && account.user?.preferences?.agenda?.list?.completionBehavior === 'delete'
    if(shouldDelete) {
        for(const node of tree.byId.values()) transaction.delete(db.collection('tasks').doc(node.uid))
        return { statuses: Object.fromEntries(statuses), deleted: true, deletedIds: [...tree.byId.keys()] }
    }
    for(const [id, status] of statuses) {
        if(tree.byId.get(id)?.status !== status) transaction.update(db.collection('tasks').doc(id), { status, updatedAt: new Date() })
    }
    return { statuses: Object.fromEntries(statuses), deleted: false, deletedIds: [] }
})

export { deriveParentStatus, reconcileTaskTree, setTaskStatus }
