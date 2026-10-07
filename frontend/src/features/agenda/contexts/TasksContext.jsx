import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useCircleTasks, useUserTasks } from '../services/taskService'
import { enqueueTaskCreate, enqueueTaskDelete, enqueueTaskPatch, flushPendingTaskPatches, waitForTaskPendingFlush } from '../services/taskCacheService'
import { useCircles } from '../../socials/contexts/CirclesContext'
import { MAX_USER_TASKS } from '../utils/taskUtils'
import { extractTaskTitleMetadata } from '../utils/naturalLanguage'
import { post } from '../../../shared/services/apiService'
import { deriveTreeStatuses } from '../utils/taskViewUtils'
import { useRewardFx } from '../../economy/RewardFxContext'
import { useQuests } from '../../quests/QuestContext'

const TasksContext = createContext({ user: [], circle: [] })

const TasksProvider = ({ profile, children }) => {
    const circles = useCircles()
    const circleIds = useMemo(() => circles.map((c) => c.uid), [circles])

    const { tasks: allTasks, isReady: tasksReady } = useUserTasks(profile.uid)
    const sharedTasks = useCircleTasks(circleIds)
    const combinedTasks = useMemo(() => [...new Map([...allTasks, ...sharedTasks].map((task) => [task.uid, task])).values()], [allTasks, sharedTasks])

    const user = useMemo(
        () => combinedTasks.filter((task) => !(task.circleId || extractTaskTitleMetadata(task.title).circleId)),
        [combinedTasks]
    )
    const circle = useMemo(
        () => combinedTasks.filter((task) => circleIds.includes(task.circleId || extractTaskTitleMetadata(task.title).circleId)),
        [combinedTasks, circleIds]
    )

    // creates are stored as full objects
    // patches are partial objects merged over server data
    const [localTasks, setLocalTasks] = useState({})
    const pendingCreateIdsRef = useRef(new Set())
    const [locallyDeletedTaskIds, setLocallyDeletedTaskIds] = useState(() => new Set())
    const { celebrateReward } = useRewardFx()
    const { reportQuestProgress } = useQuests()

    const patchLocal = useCallback((taskId, patch) => {
        if (!taskId || !patch) return
        setLocalTasks((prev) => ({
            ...prev,
            [taskId]: { ...(prev[taskId] || {}), ...patch },
        }))
    }, [])

    const clearLocal = useCallback((taskId) => {
        setLocalTasks((prev) => {
            if (!Object.hasOwn(prev, taskId)) return prev
            const next = { ...prev }
            delete next[taskId]
            return next
        })
    }, [])

    // optimistic local preview
    const applyTaskPatch = patchLocal

    const doesServerTaskMatchLocalPatch = useCallback((serverTask, localPatch) => {
        if(!serverTask || !localPatch) return false

        return Object.entries(localPatch).every(([key, localValue]) => {
            const serverValue = serverTask[key]

            if(localValue instanceof Date && serverValue instanceof Date) {
                return localValue.getTime() === serverValue.getTime()
            }

            if(typeof localValue === 'object' && localValue !== null) {
                return JSON.stringify(serverValue) === JSON.stringify(localValue)
            }

            return serverValue === localValue
        })
    }, [])

    // prevent immediate firebase writes
    const commitTaskPatch = useCallback(async (taskId, patch) => {

        if (!taskId || !patch || !Object.keys(patch).length) return
        const { status, ...otherFields } = patch
        const currentTasks = [...user, ...circle]
        const previousParentId = currentTasks.find((task) => task.uid === taskId)?.parentTaskId
        if(Object.keys(otherFields).length) {
            patchLocal(taskId, otherFields)
            await enqueueTaskPatch(taskId, otherFields)
            if(Object.hasOwn(otherFields, 'parentTaskId')) {
                const rootsToReconcile = [...new Set([taskId, previousParentId].filter(Boolean))]
                await Promise.all(rootsToReconcile.map(async (id) => {
                    const result = await post(`/v1/tasks/${encodeURIComponent(id)}/reconcile`)
                    Object.entries(result.statuses || {}).forEach(([nodeId, nextStatus]) => patchLocal(nodeId, { status: nextStatus }))
                    if(result.deleted) setLocallyDeletedTaskIds((prev) => new Set([...prev, ...result.deletedIds]))
                }))
            }
        }
        if(status === undefined) return

        const derived = deriveTreeStatuses(currentTasks, new Map([[taskId, status]]))
        patchLocal(taskId, { status })
        currentTasks.filter((task) => task.uid !== taskId && derived.get(task.uid) !== task.status).forEach((task) => patchLocal(task.uid, { status: derived.get(task.uid) }))

        try {
            await flushPendingTaskPatches()
            await waitForTaskPendingFlush(taskId)
            const result = await post(`/v1/tasks/${encodeURIComponent(taskId)}/status`, {
                status,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            })
            Object.entries(result.statuses || {}).forEach(([id, nextStatus]) => patchLocal(id, { status: nextStatus }))
            if(result.deleted) setLocallyDeletedTaskIds((prev) => new Set([...prev, ...(result.deletedIds || [taskId])]))
            if(result.changed && status === 'Completed') {
                if(result.xp) celebrateReward({ xp: result.xp })
                reportQuestProgress(result)
            }
            return result
        } catch(error) {
            currentTasks.forEach((task) => clearLocal(task.uid))
            throw error
        }

    }, [patchLocal, clearLocal, user, circle, celebrateReward, reportQuestProgress])

    const createTaskOptimistic = useCallback((draftTask = {}) => {

        if (user.length >= MAX_USER_TASKS) {
            return { taskId: null, blockedReason: 'max_user_tasks' }
        }

        const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const now = new Date()

        pendingCreateIdsRef.current.add(taskId)

        patchLocal(taskId, {
            uid: taskId,
            userId: profile.uid,
            status: 'Incomplete',
            listIndex: -1,
            parentTaskId: null,
            siblingIndex: 0,
            boardIndex: -1,
            createdAt: now,
            updatedAt: now,
            ...draftTask,
        })

        enqueueTaskCreate(taskId, draftTask)
            .then(async () => {
                if(!draftTask.parentTaskId) return
                try {
                    const result = await post(`/v1/tasks/${encodeURIComponent(draftTask.parentTaskId)}/reconcile`)
                    Object.entries(result.statuses || {}).forEach(([id, status]) => patchLocal(id, { status }))
                    if(result.deleted) setLocallyDeletedTaskIds((prev) => new Set([...prev, ...result.deletedIds]))
                } catch(error) { console.error('Could not reconcile parent status', error) }
            })
            .catch(() => {
                pendingCreateIdsRef.current.delete(taskId)
                clearLocal(taskId)
            })

        return { taskId }

    }, [patchLocal, clearLocal, profile.uid, user.length])

    const deleteTaskOptimistic = useCallback(async (taskId) => {
        if(!taskId) return
        const tasks = [...user, ...circle]
        const byParent = new Map()
        tasks.forEach((task) => byParent.set(task.parentTaskId, [...(byParent.get(task.parentTaskId) || []), task.uid]))
        const ids = []
        const collect = (id) => { (byParent.get(id) || []).forEach(collect); ids.push(id) }
        collect(taskId)
        const parentId = tasks.find((task) => task.uid === taskId)?.parentTaskId

        setLocallyDeletedTaskIds((prev) => {
            const next = new Set(prev)
            ids.forEach((id) => next.add(id))
            return next
        })

        try {
            await Promise.all(ids.map((id) => enqueueTaskDelete(id)))
            if(parentId) {
                const result = await post(`/v1/tasks/${encodeURIComponent(parentId)}/reconcile`)
                Object.entries(result.statuses || {}).forEach(([id, status]) => patchLocal(id, { status }))
                if(result.deleted) setLocallyDeletedTaskIds((prev) => new Set([...prev, ...result.deletedIds]))
            }
        } catch(error) {
            setLocallyDeletedTaskIds((prev) => {
                const next = new Set(prev)
                ids.forEach((id) => next.delete(id))
                return next
            })
            throw error
        }
    }, [user, circle, patchLocal])

    useEffect(() => {

        if (!pendingCreateIdsRef.current.size) return

        const serverIds = new Set([...user, ...circle].map((task) => task.uid))

        for (const taskId of [...pendingCreateIdsRef.current]) {
            if (!serverIds.has(taskId)) continue
            pendingCreateIdsRef.current.delete(taskId)
            clearLocal(taskId)
        }

    }, [circle, clearLocal, user])

    useEffect(() => {
        if(!locallyDeletedTaskIds.size) return

        const serverIds = new Set([...user, ...circle].map((task) => task.uid))

        setLocallyDeletedTaskIds((prev) => {
            const next = new Set(prev)

            for(const taskId of prev) {
                if(!serverIds.has(taskId)) {
                    next.delete(taskId)
                    clearLocal(taskId)
                }
            }

            return next.size === prev.size ? prev : next
        })
    }, [circle, clearLocal, locallyDeletedTaskIds.size, user])

    useEffect(() => {

        const serverById = new Map([...user, ...circle].map((task) => [task.uid, task]))

        Object.entries(localTasks).forEach(([taskId, localPatch]) => {
            const serverTask = serverById.get(taskId)
            if(!serverTask) return

            if(doesServerTaskMatchLocalPatch(serverTask, localPatch)) {
                clearLocal(taskId)
            }
        })

    }, [circle, clearLocal, doesServerTaskMatchLocalPatch, localTasks, user])

    const mergedTasks = useMemo(() => {

        const byId = new Map([...user, ...circle].map((t) => [t.uid, t]))

        // overlay local patches on top of server data
        Object.entries(localTasks).forEach(([taskId, local]) => {
            byId.set(taskId, { ...(byId.get(taskId) || {}), ...local })
        })

        return [...byId.values()].filter((task) => !locallyDeletedTaskIds.has(task.uid))

    }, [user, circle, localTasks, locallyDeletedTaskIds])

    return (
        <TasksContext.Provider value={{
            user: mergedTasks.filter((t) => !(t.circleId || extractTaskTitleMetadata(t.title).circleId)),
            circle: mergedTasks.filter((t) => circleIds.includes(t.circleId || extractTaskTitleMetadata(t.title).circleId)),
            isReady: tasksReady,
            applyTaskPatch,
            commitTaskPatch,
            createTaskOptimistic,
            deleteTaskOptimistic,
        }}>
            {children}
        </TasksContext.Provider>
    )

}

const useTasks = () => useContext(TasksContext)

export { TasksProvider, useTasks }
