import { extractTaskTitleMetadata, normalizeTaskTitle } from './naturalLanguage'
import { formatRelativeTaskDate } from '../../../shared/utils/formatters'

const LIST_GROUP_BY = {
    DUE_DATE: 'dueDate',
}

const sortTasksByListIndex = (tasks = []) => {
    return [...tasks].sort((a, b) => {
        const aListIndex = typeof a?.listIndex === 'number' ? a.listIndex : -1
        const bListIndex = typeof b?.listIndex === 'number' ? b.listIndex : -1

        if(aListIndex !== -1 && bListIndex !== -1) return aListIndex - bListIndex
        if(aListIndex !== -1) return -1
        if(bListIndex !== -1) return 1

        const aCreated = a?.createdAt?.seconds ? a.createdAt.seconds : 0
        const bCreated = b?.createdAt?.seconds ? b.createdAt.seconds : 0

        return aCreated - bCreated
    })
}

const taskTitleToDueDateKey = (title) => {
    const metadata = extractTaskTitleMetadata(normalizeTaskTitle(title))
    return metadata?.dueDate || 'none'
}

const formatDueDateGroupLabel = (dateKey) => {
    return formatRelativeTaskDate(dateKey, { fallbackLabel: 'No Date' })
}

const getTaskGroupKey = (task, groupBy = LIST_GROUP_BY.DUE_DATE) => {
    if(groupBy === LIST_GROUP_BY.DUE_DATE) return taskTitleToDueDateKey(task?.title)
    return 'all'
}

const getGroupLabel = (groupKey, groupBy = LIST_GROUP_BY.DUE_DATE) => {
    if(groupBy === LIST_GROUP_BY.DUE_DATE) return formatDueDateGroupLabel(groupKey)
    return 'All tasks'
}

const buildGroupedTaskSections = (tasks = [], groupBy = LIST_GROUP_BY.DUE_DATE) => {
    const ordered = sortTasksByListIndex(tasks)
    const groups = new Map()

    ordered.forEach((task) => {
        const key = getTaskGroupKey(task, groupBy)
        if(!groups.has(key)) groups.set(key, [])
        groups.get(key).push(task)
    })

    return [...groups.entries()].map(([key, groupTasks]) => ({
        key,
        label: getGroupLabel(key, groupBy),
        tasks: groupTasks,
    }))
}

const buildChildCounts = (tasks = []) => {
    const counts = new Map()

    tasks.forEach((task) => {
        const parentId = task.parentTaskId ?? null
        if(!parentId) return
        counts.set(parentId, (counts.get(parentId) || 0) + 1)
    })

    return counts
}

const buildDepthMap = (tasks = []) => {
    const byId = new Map(tasks.map((task) => [task.uid, task]))
    const depthMap = new Map()

    tasks.forEach((task) => {
        let depth = 0
        let parentId = task.parentTaskId ?? null
        const seen = new Set()

        while(parentId && !seen.has(parentId)) {
            seen.add(parentId)
            const parent = byId.get(parentId)
            if(!parent) break
            depth += 1
            parentId = parent.parentTaskId ?? null
        }

        depthMap.set(task.uid, depth)
    })

    return depthMap
}

const deriveStatusByTaskId = (tasks = [], overrides = new Map()) => {
    const childrenByParentId = new Map()
    const statusById = new Map()

    tasks.forEach((task) => {
        const status = overrides.has(task.uid)
            ? overrides.get(task.uid)
            : (task.status === 'Completed' ? 'Completed' : 'Incomplete')

        statusById.set(task.uid, status)

        const parentId = task.parentTaskId ?? null
        if(!parentId) return
        if(!childrenByParentId.has(parentId)) childrenByParentId.set(parentId, [])
        childrenByParentId.get(parentId).push(task.uid)
    })

    let changed = true
    let passCount = 0
    const maxPasses = tasks.length

    while(changed && passCount < maxPasses) {
        changed = false
        passCount += 1

        for(const [taskId] of statusById.entries()) {
            const childIds = childrenByParentId.get(taskId) || []
            if(childIds.length === 0) continue

            const desiredStatus = childIds.every((childId) => statusById.get(childId) === 'Completed')
                ? 'Completed'
                : 'Incomplete'

            if(statusById.get(taskId) !== desiredStatus) {
                statusById.set(taskId, desiredStatus)
                changed = true
            }
        }
    }

    return statusById
}

const buildListReindexUpdates = (tasks = []) => {
    const ordered = sortTasksByListIndex(tasks)

    return ordered
        .map((task, index) => ({ taskId: task.uid, listIndex: index, currentListIndex: task.listIndex }))
        .filter((item) => item.currentListIndex !== item.listIndex)
}

const resolveInsertListIndexForGroup = ({
    tasks = [],
    groupBy = LIST_GROUP_BY.DUE_DATE,
    draftTask = {},
}) => {
    const ordered = sortTasksByListIndex(tasks)
    const currentMaxListIndex = ordered.reduce((max, task) => {
        if(typeof task?.listIndex !== 'number') return max
        return Math.max(max, task.listIndex)
    }, -1)

    const targetGroupKey = getTaskGroupKey(draftTask, groupBy)
    const tasksInTargetGroup = ordered.filter((task) => getTaskGroupKey(task, groupBy) === targetGroupKey)

    if(tasksInTargetGroup.length === 0) return currentMaxListIndex + 1

    const groupMaxIndex = tasksInTargetGroup.reduce((max, task) => {
        if(typeof task?.listIndex !== 'number') return max
        return Math.max(max, task.listIndex)
    }, -1)

    return groupMaxIndex + 1
}

const buildShiftedListIndexUpdates = (tasks = [], insertIndex = 0) => {
    return sortTasksByListIndex(tasks)
        .filter((task) => typeof task?.listIndex === 'number' && task.listIndex >= insertIndex)
        .map((task) => ({
            taskId: task.uid,
            listIndex: task.listIndex + 1,
        }))
}

export {
    sortTasksByListIndex,
    LIST_GROUP_BY,
    getTaskGroupKey,
    getGroupLabel,
    buildGroupedTaskSections,
    buildChildCounts,
    buildDepthMap,
    deriveStatusByTaskId,
    buildListReindexUpdates,
    resolveInsertListIndexForGroup,
    buildShiftedListIndexUpdates,
}