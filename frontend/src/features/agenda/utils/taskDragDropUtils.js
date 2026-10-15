const findTaskSectionByTaskId = (groupedSections = [], taskId) => {

    if(!taskId) return null

    return groupedSections.find((section) => (
        Array.isArray(section?.tasks) && section.tasks.some((task) => task.uid === taskId)
    )) || null

}

const buildSortableIds = (tasks = []) => tasks.map((task) => task.uid)

const buildReorderPlanForSection = ({ groupedSections = [], activeId, overId }) => {

    if (!activeId || !overId || activeId === overId) return null

    const activeSection = findTaskSectionByTaskId(groupedSections, activeId)
    const overSection = findTaskSectionByTaskId(groupedSections, overId)

    if (!activeSection || !overSection || activeSection.key !== overSection.key) return null

    const sectionTasks = activeSection.tasks || []
    const fromIndex = sectionTasks.findIndex((task) => task.uid === activeId)
    const toIndex = sectionTasks.findIndex((task) => task.uid === overId)

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return null

    const active = sectionTasks[fromIndex]
    const over = sectionTasks[toIndex]
    // Only siblings can exchange positions; move their descendants with them.
    if((active.parentTaskId || null) !== (over.parentTaskId || null)) return null
    const descendantIds = (rootId) => {
        const ids = new Set([rootId])
        let changed = true
        while(changed) {
            changed = false
            for(const task of sectionTasks) {
                if(!ids.has(task.uid) && ids.has(task.parentTaskId)) {
                    ids.add(task.uid)
                    changed = true
                }
            }
        }
        return ids
    }
    const activeIds = descendantIds(activeId)
    const overIds = descendantIds(overId)
    const moving = sectionTasks.filter((task) => activeIds.has(task.uid))
    const reordered = sectionTasks.filter((task) => !activeIds.has(task.uid))
    const targetIndex = fromIndex < toIndex
        ? reordered.reduce((last, task, index) => overIds.has(task.uid) ? index + 1 : last, 0)
        : reordered.findIndex((task) => task.uid === overId)
    reordered.splice(targetIndex, 0, ...moving)

    return {
        sectionKey: activeSection.key,
        reorderedSectionTasks: reordered,
    }

}

const buildListIndexPatchUpdates = (tasks = []) => {

    return tasks
        .map((task, index) => ({
            taskId: task.uid,
            listIndex: index,
            currentListIndex: typeof task.listIndex === 'number' ? task.listIndex : null,
        }))
        .filter((update) => update.currentListIndex !== update.listIndex)
        .map(({ taskId, listIndex }) => ({ taskId, listIndex }))

}

const buildGroupPreviewSections = ({ groupedSections = [], sectionKey, reorderedSectionTasks }) => {

    if(!sectionKey || !Array.isArray(reorderedSectionTasks)) return groupedSections

    return groupedSections.map((section) => (
        section.key === sectionKey
            ? { ...section, tasks: reorderedSectionTasks }
            : section
    ))

}

export {
    findTaskSectionByTaskId,
    buildSortableIds,
    buildReorderPlanForSection,
    buildListIndexPatchUpdates,
    buildGroupPreviewSections,
}
