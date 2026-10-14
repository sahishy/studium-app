const getCreatedTime = (task) => task?.createdAt?.seconds ?? task?.createdAt?.getTime?.() ?? 0

const getCircleId = (title) => {
    const segments = Array.isArray(title?.segments) ? title.segments : []
    return segments.find((segment) => segment?.type === 'widget' && segment?.widgetType === 'circle')?.value?.circleId || ''
}

const filterVisibleTasks = ({ userTasks = [], circleTasks = [], isCircleView = false, circleId = null }) => {
    if (!isCircleView) return [...userTasks, ...circleTasks]
    return circleTasks.filter((task) => String(getCircleId(task.title)) === String(circleId || ''))
}

const buildTaskTree = (tasks = []) => {
    const byId = new Map(tasks.map((task) => [task.uid, task]))
    const childrenById = new Map()
    tasks.forEach((task) => {
        const parentId = task.parentTaskId ?? null
        if (!parentId || !byId.has(parentId)) return
        if (!childrenById.has(parentId)) childrenById.set(parentId, [])
        childrenById.get(parentId).push(task)
    })
    childrenById.forEach((children) => children.sort((a, b) => (a.siblingIndex ?? 0) - (b.siblingIndex ?? 0)))
    const roots = tasks.filter((task) => !task.parentTaskId || !byId.has(task.parentTaskId))
    return { byId, childrenById, roots }
}

const getDescendants = (taskId, childrenById) => {
    const result = []
    const visit = (id) => (childrenById.get(id) || []).forEach((child) => {
        result.push(child)
        visit(child.uid)
    })
    visit(taskId)
    return result
}

const sortBoardTasks = (tasks = []) => [...tasks].sort((a, b) => {
    const aBoard = Number.isFinite(a.boardIndex) && a.boardIndex >= 0 ? a.boardIndex : null
    const bBoard = Number.isFinite(b.boardIndex) && b.boardIndex >= 0 ? b.boardIndex : null
    if (aBoard !== null && bBoard !== null && aBoard !== bBoard) return aBoard - bBoard
    if (aBoard !== null) return -1
    if (bBoard !== null) return 1
    const aList = Number.isFinite(a.listIndex) ? a.listIndex : Number.MAX_SAFE_INTEGER
    const bList = Number.isFinite(b.listIndex) ? b.listIndex : Number.MAX_SAFE_INTEGER
    return aList - bList || getCreatedTime(a) - getCreatedTime(b) || String(a.uid).localeCompare(String(b.uid))
})

const deriveTreeStatuses = (tasks = [], overrides = new Map()) => {
    const { childrenById } = buildTaskTree(tasks)
    const result = new Map()
    const resolve = (task) => {
        const children = childrenById.get(task.uid) || []
        const ownStatus = overrides.get(task.uid) || task.status || 'Incomplete'
        if (!children.length) {
            result.set(task.uid, ownStatus)
            return ownStatus
        }
        const childStatuses = children.map(resolve)
        const status = childStatuses.every((value) => value === 'Completed')
            ? 'Completed'
            : childStatuses.every((value) => value === 'Incomplete')
                ? 'Incomplete'
                : 'In Progress'
        result.set(task.uid, status)
        return status
    }
    buildTaskTree(tasks).roots.forEach(resolve)
    return result
}

const hasTasksDueOnDate = (tasks = [], dateKey) => tasks.some((task) =>
    task.status !== 'Completed' && (task.title?.segments || []).some((segment) =>
        segment.type === 'widget' && segment.widgetType === 'date' && segment.value?.dueDate === dateKey
    )
)

export { hasTasksDueOnDate, buildTaskTree, deriveTreeStatuses, filterVisibleTasks, getDescendants, sortBoardTasks }
