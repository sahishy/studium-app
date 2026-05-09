import { extractTaskTitleMetadata, normalizeTaskTitle } from './naturalLanguage'
import { formatRelativeTaskDate } from '../../../shared/utils/formatters'
import { isTitleMostlyLowercase } from './taskParsingSlateUtils'

const LIST_GROUP_OPTIONS = [
    { id: 'none', label: 'None' },
    { id: 'dueDate', label: 'Date' },
    { id: 'course', label: 'Course' },
]

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

const getTaskCourseMetadata = (task) => {
    const metadata = extractTaskTitleMetadata(normalizeTaskTitle(task?.title))
    return {
        courseId: metadata?.courseId || 'none',
        courseTitle: metadata?.courseTitle || '',
    }
}

const getTaskCourseKey = (task) => {
    const normalizedTitle = normalizeTaskTitle(task?.title)
    const courseWidget = normalizedTitle.segments.find(
        (seg) => seg?.type === 'widget' && seg?.widgetType === 'course'
    )

    return courseWidget?.value?.courseId || getTaskCourseMetadata(task).courseId || 'none'
}

const getTaskCourseLabel = (task) => {
    const normalizedTitle = normalizeTaskTitle(task?.title)
    const courseWidget = normalizedTitle.segments.find(
        (seg) => seg?.type === 'widget' && seg?.widgetType === 'course'
    )

    return courseWidget?.value?.title || courseWidget?.rawText || 'No Course'
}

const getTaskGroupKey = (task, groupBy = 'dueDate') => {
    if (groupBy === 'dueDate') return getTaskDueDateKey(task)
    if (groupBy === 'course') return getTaskCourseKey(task)
    return 'all'
}

const getGroupLabel = (groupKey, groupBy = 'dueDate', groupTasks = []) => {
    if (groupBy === 'dueDate') {
        return formatRelativeTaskDate(groupKey, { fallbackLabel: 'No Date' })
    }

    if (groupBy === 'course') {
        if (groupKey === 'none') return 'No Course'
        return getTaskCourseLabel(groupTasks[0])
    }

    return 'All tasks'
}

const parseIsoDateKeyToLocalDate = (key) => {

    if (typeof key !== 'string') return null
    const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return null

    const year = Number(match[1])
    const month = Number(match[2]) - 1
    const day = Number(match[3])
    const date = new Date(year, month, day)
    return Number.isNaN(date.getTime()) ? null : date

}

const sortGroupEntries = (entries = [], groupBy = 'dueDate') => {

    if (groupBy === 'course') {
        return [...entries].sort((a, b) => {
            if (a[0] === 'none' && b[0] !== 'none') return -1
            if (b[0] === 'none' && a[0] !== 'none') return 1
            const aLabel = getGroupLabel(a[0], groupBy, a[1])
            const bLabel = getGroupLabel(b[0], groupBy, b[1])
            return aLabel.localeCompare(bLabel, undefined, { sensitivity: 'base' })
        })
    }

    if (groupBy === 'dueDate') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const rank = (key) => {
            if (key === 'none') return { bucket: 1, time: 0 }
            const date = parseIsoDateKeyToLocalDate(key)
            if (!date) return { bucket: 1, time: 0 }

            const time = date.getTime()
            return {
                bucket: time < today.getTime() ? 0 : 2,
                time,
            }
        }

        return [...entries].sort((a, b) => {
            const ra = rank(a[0])
            const rb = rank(b[0])
            if (ra.bucket !== rb.bucket) return ra.bucket - rb.bucket
            return ra.time - rb.time
        })
    }

    return entries

}

const buildGroupedTaskSections = (tasks = [], groupBy = 'dueDate', options = {}) => {

    const { forcedGroupKeyByTaskId = {} } = options
    const ordered = sortTasksByListIndex(tasks)
    const tasksById = new Map(ordered.map((task) => [task.uid, task]))
    const groups = new Map()

    const resolveGroupKey = (task) => {

        // subtasks inherit root parent group key
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

    return sortGroupEntries([...groups.entries()], groupBy).map(([key, groupTasks]) => ({
        key,
        label: getGroupLabel(key, groupBy, groupTasks),
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

// parent task completion based on children tasks, recursive
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

const buildInheritedGroupTitleFromSourceTask = ({ sourceTask, groupBy = 'dueDate' }) => {

    if (!sourceTask) return ''

    const sourceGroupKey = getTaskGroupKey(sourceTask, groupBy)
    if (!sourceGroupKey || sourceGroupKey === 'none') return ''

    if (groupBy === 'dueDate') {

        const normalizedTitle = normalizeTaskTitle(sourceTask.title)
        const dateWidget = normalizedTitle.segments.find(
            (seg) => seg?.type === 'widget' && seg?.widgetType === 'date'
        )
        const rawDateLabel = dateWidget?.rawText || dateWidget?.displayText || ''
        const formattedLabel = formatRelativeTaskDate(sourceGroupKey, { fallbackLabel: sourceGroupKey })
        const resolvedLabel = isTitleMostlyLowercase(rawDateLabel) ? formattedLabel.toLowerCase() : formattedLabel

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
    LIST_GROUP_OPTIONS,
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