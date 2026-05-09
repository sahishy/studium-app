import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createTask, triggerTaskCompletionEffects, useUserTasks, useCircleTasks } from '../services/taskService'
import { enqueueTaskPatch } from '../services/taskCacheService'
import { useCircles } from '../../circles/contexts/CirclesContext'
import { MAX_USER_TASKS } from '../utils/taskUtils'

const TasksContext = createContext({ user: [], circle: [] })

const TasksProvider = ({ profile, children }) => {
    const circles = useCircles()
    const circleIds = useMemo(() => circles.map((c) => c.uid), [circles])

    const { tasks: user, isReady: userReady } = useUserTasks(profile.uid)
    const { tasks: circle, isReady: circleReady } = useCircleTasks(circleIds)

    // creates are stored as full objects
    // patches are partial objects merged over server data
    const [localTasks, setLocalTasks] = useState({})
    const pendingCreateIdsRef = useRef(new Set())

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
        patchLocal(taskId, patch)

        if (patch.status === 'Completed') {
            triggerTaskCompletionEffects(taskId).catch(() => {
                //
            })
        }

        try {
            await enqueueTaskPatch(taskId, patch)
        } catch {
            // keep local optimistic patch if write fails
        }

    }, [patchLocal, clearLocal])

    const createTaskOptimistic = useCallback((draftTask = {}) => {

        const ownerType = draftTask.ownerType || 'user'
        if (ownerType === 'user' && user.length >= MAX_USER_TASKS) {
            return { taskId: null, blockedReason: 'max_user_tasks' }
        }

        const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const now = new Date()

        pendingCreateIdsRef.current.add(taskId)

        patchLocal(taskId, {
            uid: taskId,
            ownerType: 'user',
            status: 'Incomplete',
            listIndex: -1,
            parentTaskId: null,
            siblingIndex: 0,
            boardIndex: -1,
            createdAt: now,
            updatedAt: now,
            ...draftTask,
        })

        createTask({ ...draftTask, taskId })
            .catch(() => {
                pendingCreateIdsRef.current.delete(taskId)
                clearLocal(taskId)
            })

        return { taskId }

    }, [patchLocal, clearLocal, user.length])

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

        return [...byId.values()]

    }, [user, circle, localTasks])

    return (
        <TasksContext.Provider value={{
            user: mergedTasks.filter((t) => (t.ownerType || 'user') === 'user'),
            circle: mergedTasks.filter((t) => t.ownerType === 'circle'),
            isReady: userReady && circleReady,
            applyTaskPatch,
            commitTaskPatch,
            createTaskOptimistic,
        }}>
            {children}
        </TasksContext.Provider>
    )

}

const useTasks = () => useContext(TasksContext)

export { TasksProvider, useTasks }