import { arrayMove } from '@dnd-kit/sortable'

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

    return {
        sectionKey: activeSection.key,
        reorderedSectionTasks: arrayMove(sectionTasks, fromIndex, toIndex),
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
