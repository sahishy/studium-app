import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { FaArrowsUpDown, FaChevronDown } from 'react-icons/fa6'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import BottomPadding from '../../../shared/components/ui/BottomPadding'
import { toDateFromRelativeInput } from '../../../shared/utils/formatters'
import ListTask from '../components/ListTask'
import TaskParsingInput from '../components/TaskParsingInput'
import { useTasks } from '../contexts/TasksContext'
import { useCircles } from '../../socials/contexts/CirclesContext'
import { useCourses } from '../../courses/contexts/CoursesContext'
import { updateTaskGroupingPreference } from '../services/taskService'
import { enqueueTaskPatch } from '../services/taskCacheService'
import { buildChildCounts, buildDepthMap, buildGroupedTaskSections, buildInheritedGroupTitleFromSourceTask, buildListReindexUpdates, buildShiftedListIndexUpdates, deriveStatusByTaskId, getTaskGroupKey, hasConflictingGroupWidget, injectGroupWidgetIfNeeded, LIST_GROUP_OPTIONS, sortTasksByListIndex } from '../utils/taskListUtils'
import { buildListIndexPatchUpdates, buildReorderPlanForSection, buildSortableIds } from '../utils/taskDragDropUtils'
import Select from '../../../shared/components/popovers/Select'
import { MAX_USER_TASKS } from '../utils/taskUtils'
import TextTooltip from '../../../shared/components/tooltips/TextTooltip'
import { extractTaskTitleMetadata, flattenTaskTitle } from '../utils/naturalLanguage'

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

    const {
        profile,
        circleId,
        isCircleView = false,
        hideCircleWidgetControl = false,
        forceCircleWidget,
    } = useOutletContext()
    const { user: userTasks, circle: circleTasks, applyTaskPatch, commitTaskPatch, createTaskOptimistic, deleteTaskOptimistic } = useTasks()
    const circles = useCircles()
    const { courses } = useCourses()

    const isTaskLimitReached = userTasks.length >= MAX_USER_TASKS

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
    // Maps newTaskId -> { groupKey, groupBy, groupTasks } so we can inject the
    // group widget at commit time rather than baking it into the initial title.
    const pendingGroupContextRef = useRef(new Map())

    const visibleTasks = useMemo(() => {
        if (!isCircleView) return [...userTasks, ...circleTasks]
        return circleTasks.filter((task) => String(extractTaskTitleMetadata(task.title).circleId || '') === String(circleId || ''))
    }, [circleId, circleTasks, isCircleView, userTasks])

    const sortedTasks = useMemo(() => sortTasksByListIndex([...visibleTasks]), [visibleTasks])
    const tasksById = useMemo(() => new Map(sortedTasks.map((t) => [t.uid, t])), [sortedTasks])
    const groupedTaskSections = useMemo(
        () => buildGroupedTaskSections(sortedTasks, selectedGroupBy, { forcedGroupKeyByTaskId }),
        [forcedGroupKeyByTaskId, selectedGroupBy, sortedTasks]
    )
    const groupedSectionKeySignature = useMemo(
        () => groupedTaskSections.map((section) => section.key).join('|'),
        [groupedTaskSections]
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
    }, [collapsedSectionsCacheKey, groupedSectionKeySignature, groupedTaskSections])

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 },
        })
    )
    useEffect(() => {
        if (!isTaskLimitReached) addTaskInputRef.current?.focusAtEnd?.()
    }, [])
    useEffect(() => {
        if (!isTaskLimitReached) return
        const container = addTaskInputRef.current
        if (!container?.contains?.(document.activeElement)) return
        document.activeElement?.blur?.()
    }, [isTaskLimitReached])

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
                .map((t) => enqueueTaskPatch(t.uid, { status: statusById.get(t.uid) }))
        )
    }, [sortedTasks])

    const reindexListTasks = useCallback(async (tasks) => {
        await Promise.all(
            buildListReindexUpdates(tasks).map(({ taskId, listIndex }) => enqueueTaskPatch(taskId, { listIndex }))
        )
    }, [])

    const handleAddTask = useCallback(async (payload) => {

        const normalizedTitle = isCircleView ? forceCircleWidget?.(payload.title) || payload.title : payload.title
        const trimmedTitle = flattenTaskTitle(normalizedTitle).trim()
        if (!trimmedTitle) {
            return
        }

        const nextIndex = sortedTasks.reduce((max, t) => (
            typeof t.listIndex === 'number' ? Math.max(max, t.listIndex) : max
        ), -1) + 1

        const fallback = sortedTasks[0] || null
        createTaskOptimistic({
            title: normalizedTitle,
            userId: fallback?.userId || profile.uid,
            status: 'Incomplete',
            listIndex: nextIndex,
            parentTaskId: null,
            siblingIndex: 0,
            type: payload.metadata.taskType || payload.parsedTaskType || 'assignment',
        })
    }, [createTaskOptimistic, forceCircleWidget, isCircleView, profile.uid, sortedTasks])

    const handleUpdateTask = useCallback(async (taskId, updates) => {
        await commitTaskPatch(taskId, updates)
        if (Object.hasOwn(updates, 'status')) {
            await syncParentStatuses(new Map([[taskId, updates.status]]))
        }
    }, [commitTaskPatch, syncParentStatuses])

    const handleBeforeTaskCommit = useCallback((payload, meta = {}) => {
        // Apply circle widget override first (existing behaviour)
        let nextPayload = payload
        if (isCircleView) {
            const nextTitle = forceCircleWidget?.(payload.title) || payload.title
            nextPayload = {
                ...payload,
                title: nextTitle,
                plainTitle: flattenTaskTitle(nextTitle),
                metadata: extractTaskTitleMetadata(nextTitle),
            }
        }

        // find out which task is being committed by looking up the task that
        // owns this payload. The editor fires onBeforeCommit from ListTask,
        // which passes the task uid via the closure in handleCreateTaskAfter.
        // we store the context keyed by taskId; meta.taskId is threaded below.
        const taskId = meta?.taskId
        const groupContext = taskId ? pendingGroupContextRef.current.get(taskId) : null

        if (groupContext) {
            const conflict = hasConflictingGroupWidget(nextPayload.title, groupContext.groupBy)
            console.log('[beforeCommit] taskId:', taskId, 'groupContext:', groupContext, 'conflict:', conflict, 'plainTitle:', nextPayload.plainTitle)
            if (conflict) {
                // user typed their own conflicting widget — mark it so
                // handleCreateTaskAfter can skip chaining a new task.
                nextPayload = { ...nextPayload, _groupWidgetConflict: true }
            } else if (!nextPayload.metadata?.taskType) {
                // no conflict: append the group widget
                const injected = injectGroupWidgetIfNeeded(
                    nextPayload.title,
                    groupContext.groupKey,
                    groupContext.groupBy,
                    groupContext.groupTasks,
                )
                if (injected !== nextPayload.title) {
                    nextPayload = {
                        ...nextPayload,
                        title: injected,
                        plainTitle: flattenTaskTitle(injected),
                        metadata: extractTaskTitleMetadata(injected),
                    }
                }
            }
        }

        return nextPayload
    }, [forceCircleWidget, isCircleView])

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

        if (nextFocusId) setPendingFocusTaskId(nextFocusId)

        await deleteTaskOptimistic(taskId)
        await reindexListTasks(sortedTasks.filter((t) => t.uid !== taskId))
        await syncParentStatuses()

    }, [deleteTaskOptimistic, depthMap, groupedTaskSections, handleOutdentTask, reindexListTasks, sortedTasks, syncParentStatuses, tasksById])

    const handleCreateTaskAfter = useCallback(async (sourceTask, draftPayload = null) => {

        if (!sourceTask) return

        const effectiveSource = {
            ...sourceTask,
            ...(draftPayload ? {
                title: draftPayload.title,
                type: draftPayload.metadata?.taskType || sourceTask.type || 'assignment',
            } : {}),
        }

        // if handleBeforeTaskCommit detected that the user typed a conflicting
        // widget (like a different date than the group), it sets _groupWidgetConflict
        // on the payload. In that case we should not chain into a new blank task,
        // instead just re-focus the source task so the user can keep editing.
        console.log('[createTaskAfter] sourceTask.uid:', sourceTask.uid, 'draftPayload:', draftPayload)
        if (draftPayload?._groupWidgetConflict) {
            pendingGroupContextRef.current.delete(sourceTask.uid)
            // release the forced group pin so the task moves to its real new group
            setForcedGroupKeyByTaskId((prev) => {
                if (!Object.hasOwn(prev, sourceTask.uid)) return prev
                const next = { ...prev }
                delete next[sourceTask.uid]
                return next
            })
            setPendingFocusTaskId(sourceTask.uid)
            return
        }
        // clean up any consumed group context for the source task
        if (draftPayload) {
            pendingGroupContextRef.current.delete(sourceTask.uid)
        }

        const insertIndex = getMaxSubtreeListIndex(effectiveSource, sortedTasks, tasksById) + 1

        buildShiftedListIndexUpdates(sortedTasks, insertIndex).forEach(({ taskId, listIndex }) => {
            commitTaskPatch(taskId, { listIndex }).catch(console.error)
        })

        const isSubtask = Boolean(effectiveSource.parentTaskId)
        const parentTaskId = isSubtask ? effectiveSource.parentTaskId : null
        const siblingIndex = getNextSiblingIndex(sortedTasks, parentTaskId)

        // new tasks always start blank, group widget is injected at commit time
        const { taskId: newTaskId } = createTaskOptimistic({
            title: '',
            userId: effectiveSource.userId || profile.uid,
            status: 'Incomplete',
            listIndex: insertIndex,
            parentTaskId,
            siblingIndex,
            type: effectiveSource.type || 'assignment',
        })

        // store the group context so handleBeforeTaskCommit can inject later.
        // only for top-level tasks (subtasks don't inherit group widgets).
        if (!isSubtask) {
            const sourceSection = groupedTaskSections.find((s) =>
                s.tasks.some((t) => t.uid === effectiveSource.uid)
            )
            if (sourceSection && sourceSection.key !== 'none') {
                pendingGroupContextRef.current.set(newTaskId, {
                    groupKey: sourceSection.key,
                    groupBy: selectedGroupBy,
                    groupTasks: sourceSection.tasks,
                })
                // pin the new blank task to the source section so it doesn't
                // float into the "No Date / No Course" group while still empty.
                setForcedGroupKeyByTaskId((prev) => ({ ...prev, [newTaskId]: sourceSection.key }))
            }
        }

        setPendingFocusTaskId(newTaskId)
        setTabEligibleSubtask({ taskId: newTaskId, parentTaskId: effectiveSource.uid })

    }, [commitTaskPatch, createTaskOptimistic, groupedTaskSections, profile.uid, selectedGroupBy, sortedTasks, tasksById])

    const handleTaskBlur = useCallback((taskId) => {

        const pendingPatch = pendingOutdentRef.current.get(taskId)
        if (pendingPatch) {
            commitTaskPatch(taskId, pendingPatch)
            pendingOutdentRef.current.delete(taskId)
        }

        // clean up any pending group context for this task (it was consumed or
        // is no longer needed now that the task has been committed/blurred).
        pendingGroupContextRef.current.delete(taskId)

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

    const handleDragEnd = useCallback(async (event) => {
        const activeId = event?.active?.id
        const overId = event?.over?.id

        const reorderPlan = buildReorderPlanForSection({
            groupedSections: groupedTaskSections,
            activeId,
            overId,
        })

        if (!reorderPlan) return

        const listIndexUpdates = buildListIndexPatchUpdates(reorderPlan.reorderedSectionTasks)
        if (!listIndexUpdates.length) return

        await Promise.all(
            listIndexUpdates.map(({ taskId, listIndex }) => commitTaskPatch(taskId, { listIndex }))
        )
    }, [commitTaskPatch, groupedTaskSections])

    return (
        <>
            <div className='w-full h-full flex flex-col items-center gap-6'>

                <div className='relative flex w-full h-11 items-center justify-end'>
                    <div
                        className={`absolute left-1/2 top-1/2 -translate-1/2
                                bg-neutral5 rounded-full flex gap-3 items-center w-96 transition-all
                                ${isTaskLimitReached ? 'opacity-60 cursor-not-allowed' : 'cursor-text hover:w-104 focus-within:w-104'}
                            `}
                        tabIndex={isTaskLimitReached ? -1 : undefined}
                        onClick={() => {
                            if (!isTaskLimitReached) addTaskInputRef.current?.focusAtEnd?.();
                        }}
                    >
                        <TaskParsingInput
                            inputRef={addTaskInputRef}
                            title=''
                            circles={circles}
                            courses={courses}
                            className={`w-full h-full px-4 py-3 ${isTaskLimitReached && 'pointer-events-none'}`}
                            placeholder={isTaskLimitReached ? 'Task limit reached' : 'Add a task'}
                            clearOnEnter
                            keepFocusOnEnter
                            commitOnBlur={false}
                            allowEmptyCommit
                            onCommit={handleAddTask}
                            invertedWidgets
                            hideCircleWidgets={hideCircleWidgetControl}
                        />
                    </div>

                    <Select
                        options={LIST_GROUP_OPTIONS}
                        isOptionSelected={(option) => option.id === selectedGroupBy}
                        onSelect={handleChangeGroupBy}
                    >
                        {(isOpen) => (
                            <div className='px-4 py-2.5 rounded-full border border-neutral4 text-neutral0 font-semibold text-sm 
                                hover:bg-neutral5 transition-all flex items-center gap-1'
                            >
                                <FaArrowsUpDown className='text-xs'/>
                                {LIST_GROUP_OPTIONS.find((x) => x.id === selectedGroupBy)?.label}
                            </div>
                        )}
                    </Select>
                </div>


                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
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
                                    <SortableContext
                                        items={buildSortableIds(section.tasks)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {section.tasks.map((task) => (
                                            <ListTask
                                                key={task.uid}
                                                task={task}
                                                circles={circles}
                                                courses={courses}
                                                onBeforeCommit={handleBeforeTaskCommit}
                                                hideCircleWidgets={hideCircleWidgetControl}
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
                                    </SortableContext>
                                </div>
                            </div>
                        ))}
                    </div>
                </DndContext>

            </div>
            <BottomPadding />
        </>
    )
}

export default ListTab