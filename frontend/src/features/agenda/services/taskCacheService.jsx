import { createCacheKey, deleteCacheEntry, getCacheValue, setCacheEntry } from '../../../shared/services/cacheService'
import { CACHE_DEBOUNCE_MS, CACHE_NAMESPACES, CACHE_STORAGE_KEYS } from '../../../shared/utils/cacheUtils'
import { createTask, deleteTask, updateTask } from './taskService'

let flushTimeoutId = null
let isFlushing = false
const pendingTaskIds = new Set()
const pendingTaskFlushPromises = new Map()
let hasHydratedPendingTaskOps = false
const TASK_PENDING_PATCH_NAMESPACE = CACHE_NAMESPACES.TASK_PENDING_PATCH
const TASK_PATCH_FLUSH_DEBOUNCE_MS = CACHE_DEBOUNCE_MS.TASK_PATCH_FLUSH
const TASK_PENDING_OPS_STORAGE_KEY = CACHE_STORAGE_KEYS.TASK_PENDING_OPS

const readPersistedPendingOps = () => {
    if(typeof window === 'undefined') return {}

    try {
        const raw = window.localStorage.getItem(TASK_PENDING_OPS_STORAGE_KEY)
        if(!raw) return {}
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
        return {}
    }
}

const writePersistedPendingOps = (opsByTaskId = {}) => {
    if(typeof window === 'undefined') return

    try {
        if(!Object.keys(opsByTaskId).length) {
            window.localStorage.removeItem(TASK_PENDING_OPS_STORAGE_KEY)
            return
        }

        window.localStorage.setItem(TASK_PENDING_OPS_STORAGE_KEY, JSON.stringify(opsByTaskId))
    } catch {
        //
    }
}

const persistPendingTaskOpsSnapshot = () => {
    const snapshot = {}

    pendingTaskIds.forEach((taskId) => {
        const queued = getCacheValue(getPendingPatchKey(taskId))
        if(!queued || typeof queued !== 'object') return

        const hasCreate = Boolean(queued.create)
        const hasQueuedPatch = hasPatch(queued.patch)
        const hasDelete = Boolean(queued.delete)
        if(!hasCreate && !hasQueuedPatch && !hasDelete) return

        snapshot[taskId] = {
            create: queued.create || null,
            patch: queued.patch || {},
            delete: hasDelete,
        }
    })

    writePersistedPendingOps(snapshot)
}

const hydratePendingTaskOps = () => {
    if(hasHydratedPendingTaskOps) return
    hasHydratedPendingTaskOps = true

    const persistedOps = readPersistedPendingOps()
    Object.entries(persistedOps).forEach(([taskId, queued]) => {
        if(!taskId || !queued || typeof queued !== 'object') return

        const normalized = {
            create: queued.create || null,
            patch: queued.patch || {},
            delete: Boolean(queued.delete),
        }

        const hasCreate = Boolean(normalized.create)
        const hasQueuedPatch = hasPatch(normalized.patch)
        const hasDelete = normalized.delete
        if(!hasCreate && !hasQueuedPatch && !hasDelete) return

        setCacheEntry(getPendingPatchKey(taskId), normalized)
        pendingTaskIds.add(taskId)
    })
}

const getPendingPatchKey = (taskId) => createCacheKey(TASK_PENDING_PATCH_NAMESPACE, taskId)
const createEmptyQueuedOp = () => ({ create: null, patch: {}, delete: false })
const hasPatch = (patch) => Boolean(patch && Object.keys(patch).length)

const getQueuedTaskOp = (taskId) => {
    const queued = getCacheValue(getPendingPatchKey(taskId))
    if(!queued || typeof queued !== 'object') return createEmptyQueuedOp()

    return {
        create: queued.create || null,
        patch: queued.patch || {},
        delete: Boolean(queued.delete),
    }
}

const setQueuedTaskOp = (taskId, nextQueuedOp) => {
    if(!taskId || !nextQueuedOp) return

    const hasCreate = Boolean(nextQueuedOp.create)
    const hasQueuedPatch = hasPatch(nextQueuedOp.patch)
    const hasDelete = Boolean(nextQueuedOp.delete)

    if(!hasCreate && !hasQueuedPatch && !hasDelete) {
        deleteCacheEntry(getPendingPatchKey(taskId))
        pendingTaskIds.delete(taskId)
        persistPendingTaskOpsSnapshot()
        return
    }

    setCacheEntry(getPendingPatchKey(taskId), {
        create: nextQueuedOp.create || null,
        patch: nextQueuedOp.patch || {},
        delete: hasDelete,
    })
    pendingTaskIds.add(taskId)
    persistPendingTaskOpsSnapshot()
}

const scheduleFlush = () => {
    if(flushTimeoutId) {
        clearTimeout(flushTimeoutId)
    }

    flushTimeoutId = setTimeout(() => {
        flushPendingTaskPatches()
    }, TASK_PATCH_FLUSH_DEBOUNCE_MS)
}

const ensurePendingTaskPromise = (taskId) => {
    if(!pendingTaskFlushPromises.has(taskId)) {
        let resolvePromise
        let rejectPromise
        const promise = new Promise((resolve, reject) => {
            resolvePromise = resolve
            rejectPromise = reject
        })

        pendingTaskFlushPromises.set(taskId, {
            promise,
            resolve: resolvePromise,
            reject: rejectPromise,
        })
    }

    return pendingTaskFlushPromises.get(taskId).promise
}

const enqueueTaskCreate = (taskId, task = {}) => {
    if(!taskId || !task || !Object.keys(task).length) return

    const queued = getQueuedTaskOp(taskId)

    if(queued.delete) {
        setQueuedTaskOp(taskId, createEmptyQueuedOp())
        const pendingPromise = pendingTaskFlushPromises.get(taskId)
        pendingPromise?.resolve()
        pendingTaskFlushPromises.delete(taskId)
        return Promise.resolve()
    }

    setQueuedTaskOp(taskId, {
        ...queued,
        create: { ...(queued.create || {}), ...task },
    })

    scheduleFlush()
    return ensurePendingTaskPromise(taskId)
}

const enqueueTaskPatch = (taskId, patch = {}) => {
    if(!taskId || !patch || !Object.keys(patch).length) return

    const queued = getQueuedTaskOp(taskId)

    if(queued.delete) {
        return Promise.resolve()
    }

    if(queued.create) {
        setQueuedTaskOp(taskId, {
            ...queued,
            create: { ...queued.create, ...patch },
        })
    } else {
        setQueuedTaskOp(taskId, {
            ...queued,
            patch: { ...queued.patch, ...patch },
        })
    }

    scheduleFlush()

    return ensurePendingTaskPromise(taskId)
}

const enqueueTaskDelete = (taskId) => {
    if(!taskId) return

    const queued = getQueuedTaskOp(taskId)

    if(queued.create) {
        setQueuedTaskOp(taskId, createEmptyQueuedOp())
        const pendingPromise = pendingTaskFlushPromises.get(taskId)
        pendingPromise?.resolve()
        pendingTaskFlushPromises.delete(taskId)
        return Promise.resolve()
    }

    setQueuedTaskOp(taskId, {
        create: null,
        patch: {},
        delete: true,
    })

    scheduleFlush()

    return ensurePendingTaskPromise(taskId)
}

const flushPendingTaskPatches = async () => {
    hydratePendingTaskOps()

    if(isFlushing) {
        scheduleFlush()
        return
    }

    isFlushing = true

    try {
        const taskIds = [...pendingTaskIds]

        for(const taskId of taskIds) {
            const key = getPendingPatchKey(taskId)
            const queued = getQueuedTaskOp(taskId)

            if(!queued.create && !hasPatch(queued.patch) && !queued.delete) {
                pendingTaskIds.delete(taskId)
                const pendingPromise = pendingTaskFlushPromises.get(taskId)
                pendingPromise?.resolve()
                pendingTaskFlushPromises.delete(taskId)
                persistPendingTaskOpsSnapshot()
                continue
            }

            try {
                if(queued.delete) {
                    await deleteTask(taskId)
                } else if(queued.create) {
                    await createTask({ ...queued.create, taskId })
                } else if(hasPatch(queued.patch)) {
                    await updateTask(taskId, queued.patch)
                }

                pendingTaskIds.delete(taskId)
                deleteCacheEntry(key)
                const pendingPromise = pendingTaskFlushPromises.get(taskId)
                pendingPromise?.resolve()
                pendingTaskFlushPromises.delete(taskId)
                persistPendingTaskOpsSnapshot()
            } catch(error) {
                console.error('Failed to flush queued task patch', { taskId, error })
                const pendingPromise = pendingTaskFlushPromises.get(taskId)
                pendingPromise?.reject(error)
                pendingTaskFlushPromises.delete(taskId)
            }
        }
    } finally {
        isFlushing = false
        if(pendingTaskIds.size > 0) {
            scheduleFlush()
        }
    }
}

const initializeTaskPendingOpsFlush = () => {
    hydratePendingTaskOps()

    if(pendingTaskIds.size > 0) {
        flushPendingTaskPatches()
    }
}

const flushTaskOpsOnPageLifecycle = () => {
    hydratePendingTaskOps()

    if(pendingTaskIds.size > 0) {
        flushPendingTaskPatches()
    }
}

export {
    enqueueTaskCreate,
    enqueueTaskPatch,
    enqueueTaskDelete,
    flushPendingTaskPatches,
    initializeTaskPendingOpsFlush,
    flushTaskOpsOnPageLifecycle,
}
