import { useCallback, useMemo, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import BottomPadding from '../../../shared/components/ui/BottomPadding'
import ListTask from '../components/ListTask'
import TaskParsingInput from '../components/TaskParsingInput'
import { useTasks } from '../contexts/TasksContext'
import { useCircles } from '../../circles/contexts/CirclesContext'
import { useCourses } from '../../courses/contexts/CoursesContext'
import { createTask, deleteTask, updateTask } from '../services/taskService'
import {
    buildChildCounts,
    buildDepthMap,
    buildGroupedTaskSections,
    buildListReindexUpdates,
    deriveStatusByTaskId,
    LIST_GROUP_BY,
    sortTasksByListIndex,
} from '../utils/taskListUtils'
import { FaChevronDown } from 'react-icons/fa6'
import { useEffect } from 'react'

const ListTab = () => {
    const selectedGroupBy = LIST_GROUP_BY.DUE_DATE

    const { profile } = useOutletContext()
    const { user: userTasks, circle: circleTasks } = useTasks()
    const circles = useCircles()
    const { courses } = useCourses()

    const sortedTasks = useMemo(() => sortTasksByListIndex([...userTasks, ...circleTasks]), [circleTasks, userTasks])
    const groupedTaskSections = useMemo(
        () => buildGroupedTaskSections(sortedTasks, selectedGroupBy),
        [selectedGroupBy, sortedTasks]
    )
    const childCounts = useMemo(() => buildChildCounts(sortedTasks), [sortedTasks])
    const depthMap = useMemo(() => buildDepthMap(sortedTasks), [sortedTasks])
    const addTaskInputContainerRef = useRef(null)

    useEffect(() => {
        focusAddTaskInput();
    }, [])

    const focusAddTaskInput = useCallback(() => {
        addTaskInputContainerRef.current?.focusAtEnd?.()
    }, [])

    const syncParentStatuses = useCallback(async (overrides = new Map()) => {
        const statusById = deriveStatusByTaskId(sortedTasks, overrides)

        const updates = sortedTasks
            .filter((task) => statusById.has(task.uid) && task.status !== statusById.get(task.uid))
            .map((task) => updateTask(task.uid, { status: statusById.get(task.uid) }))

        if (updates.length) await Promise.all(updates)
    }, [sortedTasks])

    const reindexListTasks = useCallback(async (tasks) => {
        const updates = buildListReindexUpdates(tasks)
            .map(({ taskId, listIndex }) => updateTask(taskId, { listIndex }))

        if (updates.length) await Promise.all(updates)
    }, [])

    const handleAddTask = useCallback(async (payload) => {
        const nextInsertIndex = sortedTasks.reduce((max, task) => {
            if (typeof task?.listIndex !== 'number') return max
            return Math.max(max, task.listIndex)
        }, -1) + 1

        const fallbackTask = sortedTasks[0] || null
        await createTask({
            title: payload.title,
            ownerType: fallbackTask?.ownerType || 'user',
            ownerId: fallbackTask?.ownerId || profile.uid,
            status: 'Incomplete',
            listIndex: nextInsertIndex,
            parentTaskId: null,
            siblingIndex: 0,
            type: payload.metadata.taskType || payload.parsedTaskType || 'assignment',
        })
    }, [profile.uid, sortedTasks])

    const handleUpdateTask = useCallback(async (taskId, updates) => {
        await updateTask(taskId, updates)

        if (Object.hasOwn(updates, 'status')) {
            await syncParentStatuses(new Map([[taskId, updates.status]]))
        }
    }, [syncParentStatuses])

    const handleDeleteTask = useCallback(async (taskId) => {
        await deleteTask(taskId)

        const remaining = sortedTasks.filter((task) => task.uid !== taskId)
        await reindexListTasks(remaining)
        await syncParentStatuses()
    }, [reindexListTasks, sortedTasks, syncParentStatuses])

    return <>
        <div className='w-full h-full flex flex-col items-center gap-6'>

            <div
                className='px-6 py-3 bg-neutral5 rounded-full text-neutral0 cursor-text flex gap-3 items-center w-96 hover:w-104 focus-within:w-104 transition-all'
                onClick={focusAddTaskInput}
            >
                <TaskParsingInput
                    inputRef={addTaskInputContainerRef}
                    title=''
                    circles={circles}
                    courses={courses}
                    className='w-full'
                    placeholder='Add a task'
                    clearOnEnter
                    keepFocusOnEnter
                    commitOnBlur={false}
                    allowEmptyCommit
                    onCommit={handleAddTask}
                    invertedWidgets
                />
            </div>

            <div className='w-full min-h-[60vh] space-y-5'>
                {groupedTaskSections.map((section) => (
                    <div key={section.key} className='w-full flex flex-col gap-1'>

                        <div className='text-sm font-semibold text-neutral flex items-center gap-2'>
                            <FaChevronDown className='text-xs text-neutral1' />
                            {section.label}
                        </div>

                        <div>
                            {section.tasks.map((task) => (
                                <ListTask
                                    key={task.uid}
                                    task={task}
                                    circles={circles}
                                    courses={courses}
                                    depth={depthMap.get(task.uid) || 0}
                                    hasChildren={(childCounts.get(task.uid) || 0) > 0}
                                    onUpdate={handleUpdateTask}
                                    onDelete={handleDeleteTask}
                                />
                            ))}
                        </div>

                    </div>
                ))}
            </div>

        </div>
        <BottomPadding />
    </>

}

export default ListTab