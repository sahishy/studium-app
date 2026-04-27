import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createTask, updateTask, useUserTasks, useCircleTasks } from '../services/taskService'
import { useCircles } from '../../circles/contexts/CirclesContext'

const TasksContext = createContext({ user: [], circle: [] })

const TasksProvider = ({ profile, children }) => {
    const circles = useCircles()
    const circleIds = useMemo(() => circles.map((c) => c.uid), [circles])

    const { tasks: user, isReady: userReady } = useUserTasks(profile.uid)
    const { tasks: circle, isReady: circleReady } = useCircleTasks(circleIds)

    // Unified local state for both optimistic creates and in-flight patches.
    // Creates are stored as full objects; patches are partials merged over server data.
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

    // applyTaskPatch: optimistic local preview without firing a server request.
    // Used for deferred operations like outdenting where the commit happens later.
    const applyTaskPatch = patchLocal

    // commitTaskPatch: applies locally and syncs to server, then clears local state.
    const commitTaskPatch = useCallback(async (taskId, patch) => {
        if (!taskId || !patch || !Object.keys(patch).length) return
        patchLocal(taskId, patch)
        try {
            await updateTask(taskId, patch)
        } finally {
            clearLocal(taskId)
        }
    }, [patchLocal, clearLocal])

    const createTaskOptimistic = useCallback((draftTask = {}) => {
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
            dueAt: -1,
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
    }, [patchLocal, clearLocal])

    useEffect(() => {
        if (!pendingCreateIdsRef.current.size) return

        const serverIds = new Set([...user, ...circle].map((task) => task.uid))

        for (const taskId of [...pendingCreateIdsRef.current]) {
            if (!serverIds.has(taskId)) continue
            pendingCreateIdsRef.current.delete(taskId)
            clearLocal(taskId)
        }
    }, [circle, clearLocal, user])

    const mergedTasks = useMemo(() => {
        const byId = new Map([...user, ...circle].map((t) => [t.uid, t]))

        // Overlay local patches/creates on top of server data
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