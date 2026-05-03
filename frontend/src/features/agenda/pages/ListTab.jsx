import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { FaChevronDown } from 'react-icons/fa6'
import BottomPadding from '../../../shared/components/ui/BottomPadding'
import { toDateFromRelativeInput } from '../../../shared/utils/formatters'
import ListTask from '../components/ListTask'
import TaskParsingInput from '../components/TaskParsingInput'
import { useTasks } from '../contexts/TasksContext'
import { useCircles } from '../../circles/contexts/CirclesContext'
import { useCourses } from '../../courses/contexts/CoursesContext'
import { deleteTask, updateTask, updateTaskGroupingPreference } from '../services/taskService'
import { buildChildCounts, buildDepthMap, buildGroupedTaskSections, buildInheritedGroupTitleFromSourceTask, buildListReindexUpdates, buildShiftedListIndexUpdates, deriveStatusByTaskId,LIST_GROUP_OPTIONS, sortTasksByListIndex } from '../utils/taskListUtils'
import Select from '../../../shared/components/popovers/Select'

const isDescendantOf = (task, ancestorId, tasksById) => {
    let parentId = task?.parentTaskId ?? null
    const seen = new Set()
    while (parentId && !seen.has(parentId)) {
        if (parentId === ancestorId) return true
        seen.add(parentId)
        parentId = tasksById.get(parentId)?.parentTaskId ?? null
    }
    return false
}

const getMaxSubtreeListIndex = (task, sortedTasks, tasksById) => {
    return sortedTasks.reduce((max, t) => {
        if (t.uid !== task.uid && !isDescendantOf(t, task.uid, tasksById)) return max
        return typeof t.listIndex === 'number' ? Math.max(max, t.listIndex) : max
    }, task.listIndex ?? -1)
}

const getNextSiblingIndex = (tasks, parentTaskId) => {
    return tasks
        .filter((t) => t.parentTaskId === parentTaskId)
        .reduce((max, t) => Math.max(max, t.siblingIndex ?? 0), -1) + 1
}

const isPastDateGroupKey = (groupKey) => {
    if (!groupKey || groupKey === 'none') return false
    const date = toDateFromRelativeInput(groupKey)
    if (!date) return false

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return date.getTime() < today.getTime()
}

const buildCollapsedSectionsCacheKey = (profileId, groupBy) => (
    `agenda:list:collapsed-sections:${profileId || 'anonymous'}:${groupBy || 'none'}`
)

const readCollapsedSectionsFromCache = (cacheKey) => {
    try {
        const raw = localStorage.getItem(cacheKey)
        if (!raw) return {}
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
        return {}
    }
}

const writeCollapsedSectionsToCache = (cacheKey, collapsedByKey) => {
    try {
        localStorage.setItem(cacheKey, JSON.stringify(collapsedByKey || {}))
    } catch {
        //
    }
}

const ListTab = () => {

    const { profile } = useOutletContext()
    const { user: userTasks, circle: circleTasks, applyTaskPatch, commitTaskPatch, createTaskOptimistic } = useTasks()
    const circles = useCircles()
    const { courses } = useCourses()

    const defaultGroupBy = 'dueDate'
    const profileGroupBy = profile?.preferences?.groupTasksBy
    const [groupByPreference, setGroupByPreference] = useState(profileGroupBy || defaultGroupBy)

    const [pendingFocusTaskId, setPendingFocusTaskId] = useState(null)
    const [tabEligibleSubtask, setTabEligibleSubtask] = useState(null)
    const [forcedGroupKeyByTaskId, setForcedGroupKeyByTaskId] = useState({})
    const [collapsedSectionByKey, setCollapsedSectionByKey] = useState({})

    const addTaskInputRef = useRef(null)
    const selectedGroupBy = useMemo(() => {
        const available = new Set(LIST_GROUP_OPTIONS.map((option) => option.id))
        return available.has(groupByPreference) ? groupByPreference : defaultGroupBy
    }, [groupByPreference])

    useEffect(() => {
        setGroupByPreference(profileGroupBy || defaultGroupBy)
    }, [profileGroupBy])

    const pendingOutdentRef = useRef(new Map())
    const taskFocusHandlersRef = useRef(new Map())

    const sortedTasks = useMemo(() => sortTasksByListIndex([...userTasks, ...circleTasks]), [userTasks, circleTasks])
    const tasksById = useMemo(() => new Map(sortedTasks.map((t) => [t.uid, t])), [sortedTasks])
    const groupedTaskSections = useMemo(
        () => buildGroupedTaskSections(sortedTasks, selectedGroupBy, { forcedGroupKeyByTaskId }),
        [forcedGroupKeyByTaskId, selectedGroupBy, sortedTasks]
    )
    const childCounts = useMemo(() => buildChildCounts(sortedTasks), [sortedTasks])
    const depthMap = useMemo(() => buildDepthMap(sortedTasks), [sortedTasks])
    const collapsedSectionsCacheKey = useMemo(
        () => buildCollapsedSectionsCacheKey(profile?.uid, selectedGroupBy),
        [profile?.uid, selectedGroupBy]
    )

    useEffect(() => {
        const cached = readCollapsedSectionsFromCache(collapsedSectionsCacheKey)
        setCollapsedSectionByKey(cached)
    }, [collapsedSectionsCacheKey])

    useEffect(() => {
        const validKeys = new Set(groupedTaskSections.map((section) => section.key))
        setCollapsedSectionByKey((prev) => {
            const next = Object.fromEntries(
                Object.entries(prev).filter(([key, isCollapsed]) => validKeys.has(key) && Boolean(isCollapsed))
            )

            const changed = Object.keys(prev).length !== Object.keys(next).length
            if (changed) writeCollapsedSectionsToCache(collapsedSectionsCacheKey, next)
            return changed ? next : prev
        })
    }, [collapsedSectionsCacheKey, groupedTaskSections])

    useEffect(() => {
        addTaskInputRef.current?.focusAtEnd?.()
    }, [])

    useEffect(() => {
        if (!pendingFocusTaskId) return

        const hasTask = sortedTasks.some((task) => task.uid === pendingFocusTaskId)
        const focusHandler = taskFocusHandlersRef.current.get(pendingFocusTaskId)

        if (!hasTask || !focusHandler) return

        requestAnimationFrame(() => {
            focusHandler()
            setPendingFocusTaskId((current) => (current === pendingFocusTaskId ? null : current))
        })
    }, [pendingFocusTaskId, sortedTasks])

    const handleRegisterFocusHandle = useCallback((taskId, focusHandler) => {
        if (!taskId) return
        if (typeof focusHandler === 'function') {
            taskFocusHandlersRef.current.set(taskId, focusHandler)
            if (pendingFocusTaskId === taskId) {
                requestAnimationFrame(() => {
                    focusHandler()
                    setPendingFocusTaskId((current) => (current === taskId ? null : current))
                })
            }
            return
        }
        taskFocusHandlersRef.current.delete(taskId)
    }, [pendingFocusTaskId])

    const syncParentStatuses = useCallback(async (overrides = new Map()) => {
        const statusById = deriveStatusByTaskId(sortedTasks, overrides)
        await Promise.all(
            sortedTasks
                .filter((t) => statusById.has(t.uid) && t.status !== statusById.get(t.uid))
                .map((t) => updateTask(t.uid, { status: statusById.get(t.uid) }))
        )
    }, [sortedTasks])

    const reindexListTasks = useCallback(async (tasks) => {
        await Promise.all(
            buildListReindexUpdates(tasks).map(({ taskId, listIndex }) => updateTask(taskId, { listIndex }))
        )
    }, [])

    const handleAddTask = useCallback(async (payload) => {
        const nextIndex = sortedTasks.reduce((max, t) => (
            typeof t.listIndex === 'number' ? Math.max(max, t.listIndex) : max
        ), -1) + 1

        const fallback = sortedTasks[0] || null
        createTaskOptimistic({
            title: payload.title,
            ownerType: fallback?.ownerType || 'user',
            ownerId: fallback?.ownerId || profile.uid,
            status: 'Incomplete',
            listIndex: nextIndex,
            parentTaskId: null,
            siblingIndex: 0,
            type: payload.metadata.taskType || payload.parsedTaskType || 'assignment',
        })
    }, [createTaskOptimistic, profile.uid, sortedTasks])

    const handleUpdateTask = useCallback(async (taskId, updates) => {
        await commitTaskPatch(taskId, updates)
        if (Object.hasOwn(updates, 'status')) {
            await syncParentStatuses(new Map([[taskId, updates.status]]))
        }
    }, [commitTaskPatch, syncParentStatuses])

    const handleOutdentTask = useCallback((taskId) => {

        const task = tasksById.get(taskId)
        const grandparentId = tasksById.get(task?.parentTaskId)?.parentTaskId ?? null
        const siblingIndex = getNextSiblingIndex(sortedTasks, grandparentId)
        const patch = { parentTaskId: grandparentId, siblingIndex }

        const sectionKey = groupedTaskSections.find((s) => s.tasks.some((t) => t.uid === taskId))?.key || 'none'
        setForcedGroupKeyByTaskId((prev) => ({ ...prev, [taskId]: sectionKey }))
        applyTaskPatch(taskId, patch)
        pendingOutdentRef.current.set(taskId, patch)

    }, [applyTaskPatch, groupedTaskSections, sortedTasks, tasksById])

    const handleDeleteTask = useCallback(async (taskId, meta = {}) => {

        const isBackspace = meta?.reason === 'backspace'
        const task = tasksById.get(taskId)
        const hasParent = Boolean(task?.parentTaskId)
        const depth = depthMap.get(taskId) || 0

        if (isBackspace && hasParent && depth > 0) {
            handleOutdentTask(taskId)
            return
        }

        let nextFocusId = null
        if (isBackspace) {
            const section = groupedTaskSections.find((s) => s.tasks.some((t) => t.uid === taskId))
            const idx = section?.tasks.findIndex((t) => t.uid === taskId) ?? -1
            if (idx > 0) nextFocusId = section.tasks[idx - 1].uid
        }

        await deleteTask(taskId)
        await reindexListTasks(sortedTasks.filter((t) => t.uid !== taskId))
        await syncParentStatuses()

        if (nextFocusId) setPendingFocusTaskId(nextFocusId)

    }, [depthMap, groupedTaskSections, handleOutdentTask, reindexListTasks, sortedTasks, syncParentStatuses, tasksById])

    const handleCreateTaskAfter = useCallback(async (sourceTask, draftPayload = null) => {

        if (!sourceTask) return

        const effectiveSource = {
            ...sourceTask,
            ...(draftPayload ? {
                title: draftPayload.title,
                type: draftPayload.metadata?.taskType || sourceTask.type || 'assignment',
            } : {}),
        }

        const insertIndex = getMaxSubtreeListIndex(effectiveSource, sortedTasks, tasksById) + 1

        buildShiftedListIndexUpdates(sortedTasks, insertIndex).forEach(({ taskId, listIndex }) => {
            commitTaskPatch(taskId, { listIndex }).catch(console.error)
        })

        const isSubtask = Boolean(effectiveSource.parentTaskId)
        const parentTaskId = isSubtask ? effectiveSource.parentTaskId : null
        const siblingIndex = getNextSiblingIndex(sortedTasks, parentTaskId)

        // inherit group defaults for the new task from the source task
        const inheritedTitle = isSubtask
            ? ''
            : buildInheritedGroupTitleFromSourceTask({ sourceTask, groupBy: selectedGroupBy })

        const { taskId: newTaskId } = createTaskOptimistic({
            title: inheritedTitle,
            ownerType: effectiveSource.ownerType || 'user',
            ownerId: effectiveSource.ownerId || profile.uid,
            status: 'Incomplete',
            listIndex: insertIndex,
            parentTaskId,
            siblingIndex,
            type: effectiveSource.type || 'assignment',
        })

        setPendingFocusTaskId(newTaskId)

        setTabEligibleSubtask({ taskId: newTaskId, parentTaskId: effectiveSource.uid })

    }, [commitTaskPatch, createTaskOptimistic, profile.uid, selectedGroupBy, sortedTasks, tasksById])

    const handleTaskBlur = useCallback((taskId) => {

        const pendingPatch = pendingOutdentRef.current.get(taskId)
        if (pendingPatch) {
            commitTaskPatch(taskId, pendingPatch)
            pendingOutdentRef.current.delete(taskId)
        }

        setForcedGroupKeyByTaskId((prev) => {
            if (!Object.hasOwn(prev, taskId)) return prev
            const next = { ...prev }
            delete next[taskId]
            return next
        })

        if (tabEligibleSubtask?.taskId === taskId) setTabEligibleSubtask(null)

    }, [commitTaskPatch, tabEligibleSubtask])

    const handleTabInTask = useCallback(async (taskId) => {

        if (tabEligibleSubtask?.taskId !== taskId) return

        const parentTaskId = tabEligibleSubtask.parentTaskId
        const parentTask = tasksById.get(parentTaskId)
        const siblingIndex = getNextSiblingIndex(sortedTasks, parentTaskId)

        if (parentTask?.status === 'Completed') {
            await commitTaskPatch(parentTaskId, { status: 'Incomplete' })
        }

        await commitTaskPatch(taskId, { parentTaskId, siblingIndex })
        setTabEligibleSubtask(null)

    }, [commitTaskPatch, sortedTasks, tabEligibleSubtask, tasksById])

    const handleChangeGroupBy = useCallback(async (option) => {

        const nextGroupBy = option?.id
        if (!nextGroupBy || nextGroupBy === selectedGroupBy) return

        setGroupByPreference(nextGroupBy)
        try {
            await updateTaskGroupingPreference(profile.uid, nextGroupBy)
        } catch {
            setGroupByPreference(selectedGroupBy)
        }

    }, [profile.uid, selectedGroupBy])

    const handleToggleSectionCollapsed = useCallback((sectionKey) => {

        setCollapsedSectionByKey((prev) => {
            const next = { ...prev }
            if (next[sectionKey]) {
                delete next[sectionKey]
            } else {
                next[sectionKey] = true
            }
            writeCollapsedSectionsToCache(collapsedSectionsCacheKey, next)
            return next
        })
        
    }, [collapsedSectionsCacheKey])

    return (
        <>
            <div className='w-full h-full flex flex-col items-center gap-6'>

                <div className='relative flex w-full h-11 justify-end'>
                    <div
                        className='absolute left-1/2 top-1/2 -translate-1/2
                            px-4 py-3 bg-neutral5 rounded-full cursor-text 
                            flex gap-3 items-center w-96 hover:w-104 focus-within:w-104 transition-all'
                        onClick={() => addTaskInputRef.current?.focusAtEnd?.()}
                    >
                        <TaskParsingInput
                            inputRef={addTaskInputRef}
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
                    <Select
                        options={LIST_GROUP_OPTIONS}
                        isOptionSelected={(option) => option.id === selectedGroupBy}
                        onSelect={handleChangeGroupBy}
                    >
                        {(isOpen) => (
                            <p className='text-neutral1 text-xs hover:opacity-60 transition-all'>
                                Grouping by: {' '}
                                <span className='font-semibold text-neutral0'>
                                    {LIST_GROUP_OPTIONS.find((x) => x.id === selectedGroupBy)?.label}
                                </span>
                            </p>
                        )}
                    </Select>
                </div>


                <div className='w-full min-h-[60vh] space-y-5'>
                    {groupedTaskSections.map((section) => (
                        <div key={section.key} className='w-full flex flex-col gap-1'>
                            {selectedGroupBy !== 'none' && (
                                <div
                                    onClick={() => handleToggleSectionCollapsed(section.key)}
                                    className={`text-sm font-semibold flex items-center gap-2 select-none
                                    ${selectedGroupBy === 'dueDate' && isPastDateGroupKey(section.key) ? 'text-red-500' : 'text-neutral'}
                                    cursor-pointer
                                `}
                                >
                                    <FaChevronDown className={`text-xs text-neutral1 transition
                                        ${collapsedSectionByKey[section.key] && '-rotate-90'}`}
                                    />
                                    {section.label}
                                </div>
                            )}
                            <div className={collapsedSectionByKey[section.key] && 'hidden'}>
                                {section.tasks.map((task) => (
                                    <ListTask
                                        key={task.uid}
                                        task={task}
                                        circles={circles}
                                        courses={courses}
                                        onRegisterFocusHandle={handleRegisterFocusHandle}
                                        depth={depthMap.get(task.uid) || 0}
                                        hasChildren={(childCounts.get(task.uid) || 0) > 0}
                                        onUpdate={handleUpdateTask}
                                        onDelete={handleDeleteTask}
                                        onCreateTaskAfter={handleCreateTaskAfter}
                                        onTabInTask={handleTabInTask}
                                        onTaskBlur={handleTaskBlur}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

            </div>
            <BottomPadding />
        </>
    )
}

export default ListTab