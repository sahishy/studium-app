import { createCacheKey, deleteCacheEntry, getCacheValue, setCacheEntry } from '../../../shared/services/cacheService'
import { updateTask } from './taskService'

const TASK_PENDING_PATCH_NAMESPACE = 'task-pending-patch'
const TASK_PATCH_FLUSH_DEBOUNCE_MS = 1000

let flushTimeoutId = null
let isFlushing = false
const pendingTaskIds = new Set()
const pendingTaskFlushPromises = new Map()

const getPendingPatchKey = (taskId) => createCacheKey(TASK_PENDING_PATCH_NAMESPACE, taskId)

const scheduleFlush = () => {
    if(flushTimeoutId) {
        clearTimeout(flushTimeoutId)
    }

    flushTimeoutId = setTimeout(() => {
        flushPendingTaskPatches()
    }, TASK_PATCH_FLUSH_DEBOUNCE_MS)
}

const enqueueTaskPatch = (taskId, patch = {}) => {
    if(!taskId || !patch || !Object.keys(patch).length) return

    const key = getPendingPatchKey(taskId)
    const existingPatch = getCacheValue(key) || {}
    const nextPatch = { ...existingPatch, ...patch }

    setCacheEntry(key, nextPatch)
    pendingTaskIds.add(taskId)
    scheduleFlush()

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

const flushPendingTaskPatches = async () => {
    if(isFlushing) {
        scheduleFlush()
        return
    }

    isFlushing = true

    try {
        const taskIds = [...pendingTaskIds]

        for(const taskId of taskIds) {
            const key = getPendingPatchKey(taskId)
            const patch = getCacheValue(key)

            if(!patch) {
                pendingTaskIds.delete(taskId)
                const pendingPromise = pendingTaskFlushPromises.get(taskId)
                pendingPromise?.resolve()
                pendingTaskFlushPromises.delete(taskId)
                continue
            }

            try {
                await updateTask(taskId, patch)
                pendingTaskIds.delete(taskId)
                deleteCacheEntry(key)
                const pendingPromise = pendingTaskFlushPromises.get(taskId)
                pendingPromise?.resolve()
                pendingTaskFlushPromises.delete(taskId)
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

export {
    enqueueTaskPatch,
    flushPendingTaskPatches,
}
