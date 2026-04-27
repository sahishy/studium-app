import { extractTaskTitleMetadata, normalizeTaskTitle } from './naturalLanguage'
import { formatRelativeTaskDate } from '../../../shared/utils/formatters'

const LIST_GROUP_BY = {
    DUE_DATE: 'dueDate',
}

const sortTasksByListIndex = (tasks = []) => {
    return [...tasks].sort((a, b) => {
        const aIndex = typeof a?.listIndex === 'number' ? a.listIndex : -1
        const bIndex = typeof b?.listIndex === 'number' ? b.listIndex : -1

        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
        if (aIndex !== -1) return -1
        if (bIndex !== -1) return 1

        const aCreated = a?.createdAt?.seconds ?? 0
        const bCreated = b?.createdAt?.seconds ?? 0
        return aCreated - bCreated
    })
}

const getTaskDueDateKey = (task) => {
    const metadata = extractTaskTitleMetadata(normalizeTaskTitle(task?.title))
    return metadata?.dueDate || 'none'
}

const getTaskGroupKey = (task, groupBy = LIST_GROUP_BY.DUE_DATE) => {
    if (groupBy === LIST_GROUP_BY.DUE_DATE) return getTaskDueDateKey(task)
    return 'all'
}

const getGroupLabel = (groupKey, groupBy = LIST_GROUP_BY.DUE_DATE) => {
    if (groupBy === LIST_GROUP_BY.DUE_DATE) {
        return formatRelativeTaskDate(groupKey, { fallbackLabel: 'No Date' })
    }
    return 'All tasks'
}

const isMostlyLowercase = (rawText = '') => {
    const text = String(rawText || '')
    return text === text.toLowerCase() && /[a-z]/.test(text)
}

const buildGroupedTaskSections = (tasks = [], groupBy = LIST_GROUP_BY.DUE_DATE, options = {}) => {
    const { forcedGroupKeyByTaskId = {} } = options
    const ordered = sortTasksByListIndex(tasks)
    const tasksById = new Map(ordered.map((task) => [task.uid, task]))
    const groups = new Map()

    const resolveGroupKey = (task) => {
        // Subtasks inherit their root parent's group key
        let current = task
        const seen = new Set()
        while (current?.parentTaskId && !seen.has(current.parentTaskId)) {
            seen.add(current.parentTaskId)
            const parent = tasksById.get(current.parentTaskId)
            if (!parent) break
            current = parent
        }
        return getTaskGroupKey(current, groupBy)
    }

    ordered.forEach((task) => {
        const key = forcedGroupKeyByTaskId[task.uid] || resolveGroupKey(task)
        if (!groups.has(key)) groups.set(key, [])
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
        if (!parentId) return
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
        while (parentId && !seen.has(parentId)) {
            seen.add(parentId)
            const parent = byId.get(parentId)
            if (!parent) break
            depth++
            parentId = parent.parentTaskId ?? null
        }
        depthMap.set(task.uid, depth)
    })

    return depthMap
}

// Derives whether each parent task should be Completed or Incomplete
// based on whether all its children are completed. Uses recursion so
// each task is resolved once in a single pass rather than looping until stable.
const deriveStatusByTaskId = (tasks = [], overrides = new Map()) => {
    const byId = new Map(tasks.map((t) => [t.uid, t]))
    const childrenByParent = new Map()

    tasks.forEach((task) => {
        const parentId = task.parentTaskId ?? null
        if (!parentId) return
        if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, [])
        childrenByParent.get(parentId).push(task.uid)
    })

    const resolveStatus = (taskId) => {
        const children = childrenByParent.get(taskId) || []
        if (children.length === 0) {
            if (overrides.has(taskId)) return overrides.get(taskId)
            return byId.get(taskId)?.status === 'Completed' ? 'Completed' : 'Incomplete'
        }
        return children.every((id) => resolveStatus(id) === 'Completed') ? 'Completed' : 'Incomplete'
    }

    return new Map(tasks.map((t) => [t.uid, resolveStatus(t.uid)]))
}

const buildListReindexUpdates = (tasks = []) => {
    return sortTasksByListIndex(tasks)
        .map((task, index) => ({ taskId: task.uid, listIndex: index, currentListIndex: task.listIndex }))
        .filter((item) => item.currentListIndex !== item.listIndex)
}

const buildShiftedListIndexUpdates = (tasks = [], insertIndex = 0) => {
    return sortTasksByListIndex(tasks)
        .filter((task) => typeof task?.listIndex === 'number' && task.listIndex >= insertIndex)
        .map((task) => ({ taskId: task.uid, listIndex: task.listIndex + 1 }))
}

const buildInheritedGroupTitleFromSourceTask = ({ sourceTask, groupBy = LIST_GROUP_BY.DUE_DATE }) => {
    if (!sourceTask) return ''

    const sourceGroupKey = getTaskGroupKey(sourceTask, groupBy)
    if (!sourceGroupKey || sourceGroupKey === 'none') return ''

    if (groupBy === LIST_GROUP_BY.DUE_DATE) {
        const normalizedTitle = normalizeTaskTitle(sourceTask.title)
        const dateWidget = normalizedTitle.segments.find(
            (seg) => seg?.type === 'widget' && seg?.widgetType === 'date'
        )
        const rawDateLabel = dateWidget?.rawText || dateWidget?.displayText || ''
        const formattedLabel = formatRelativeTaskDate(sourceGroupKey, { fallbackLabel: sourceGroupKey })
        const resolvedLabel = isMostlyLowercase(rawDateLabel) ? formattedLabel.toLowerCase() : formattedLabel

        return {
            segments: [
                {
                    type: 'widget',
                    widgetType: 'date',
                    rawText: resolvedLabel,
                    displayText: resolvedLabel,
                    value: { dueDate: sourceGroupKey },
                },
                {
                    type: 'text',
                    rawText: ' ',
                    displayText: ' ',
                },
            ],
        }
    }

    return ''
}

export {
    LIST_GROUP_BY,
    sortTasksByListIndex,
    getTaskGroupKey,
    getGroupLabel,
    buildGroupedTaskSections,
    buildChildCounts,
    buildDepthMap,
    deriveStatusByTaskId,
    buildListReindexUpdates,
    buildShiftedListIndexUpdates,
    buildInheritedGroupTitleFromSourceTask,
}