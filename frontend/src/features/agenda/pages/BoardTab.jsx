import { useCallback, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, PointerSensor, pointerWithin, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { FaCheckCircle, FaClock, FaDotCircle, FaBook, FaCalendar } from 'react-icons/fa'
import { FaPlus } from 'react-icons/fa6'
import BoardTask, { BoardTaskGhost } from '../components/BoardTask'
import TaskParsingInput from '../components/TaskParsingInput'
import ViewOptionsButton from '../components/ViewOptionsButton'
import { useTasks } from '../contexts/TasksContext'
import { useCircles } from '../../socials/contexts/CirclesContext'
import { useCourses } from '../../courses/contexts/CoursesContext'
import { MAX_USER_TASKS } from '../utils/taskUtils'
import { extractTaskTitleMetadata, flattenTaskTitle } from '../utils/naturalLanguage'
import { buildTaskTree, deriveTreeStatuses, filterVisibleTasks, sortBoardTasks } from '../utils/taskViewUtils'
import { buildCourseWidgetSegment, buildScheduleWidgetSegment, removeWidget, upsertWidget } from '../utils/taskWidgetControlUtils'
import { insertBoardTask, commitBoardMove } from '../utils/boardPresentationUtils'
import { dateToIsoKey } from '../utils/taskScheduleUtils'

const STATUS_META = [
    { id: 'Incomplete', label: 'Incomplete', icon: FaDotCircle },
    { id: 'In Progress', label: 'In Progress', icon: FaClock },
    { id: 'Completed', label: 'Completed', icon: FaCheckCircle },
]
const groupKey = (task, groupBy) => {
    if(groupBy === 'status') return task.status || 'Incomplete'
    const meta = extractTaskTitleMetadata(task.title)
    return groupBy === 'course' ? (meta.courseId || '') : (meta.dueDate || '')
}
const buildColumns = (roots, groupBy, courses) => {
    if(groupBy === 'status') return STATUS_META
    if(groupBy === 'course') {
        const ids = new Set(roots.map((task) => groupKey(task, groupBy)).filter(Boolean))
        const known = courses
        const rest = [...ids].filter((id) => !known.some((course) => String(course.courseId) === id))
        return [{ id: '', label: 'No course', icon: FaBook }, ...known.map((course) => ({ id: String(course.courseId), label: course.title, icon: FaBook })), ...rest.map((id) => ({ id, label: 'Other course', icon: FaBook }))]
    }
    const dates = new Set(roots.map((task) => groupKey(task, groupBy)).filter(Boolean))
    dates.add(dateToIsoKey(new Date()))
    return [{ id: '', label: 'Unscheduled', icon: FaCalendar }, ...[...dates].sort().map((id) => ({ id, label: new Date(`${id}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), icon: FaCalendar }))]
}
const titleForGroup = (title, groupBy, id, courses) => {
    if(groupBy === 'status') return title
    const widgetType = groupBy === 'course' ? 'course' : 'date'
    if(!id) return removeWidget({ title, widgetType })
    return upsertWidget({ title, widgetType, builder: (existing) => groupBy === 'course'
        ? buildCourseWidgetSegment({ currentSegment: existing, courseId: id, courses })
        : buildScheduleWidgetSegment({ currentSegment: existing, dueDate: id, label: id }) })
}

// Resolves the drop target in two independent steps so a drag never has to choose between
// "reorder" and "move column": the pointer's X picks the column, its Y picks the slot inside it.
// The placement preview and final drop share the same insertion rule.
const buildCollisionDetection = (hintRef) => (args) => {
    const { active, droppableContainers, droppableRects, pointerCoordinates } = args
    const columns = droppableContainers.filter((container) => String(container.id).startsWith('column:'))
    if(!pointerCoordinates) {
        const hint = hintRef.current
        return hint ? [{ id: hint.overTaskId || `column:${hint.groupId}` }] : []
    }
    const slot = droppableContainers.find((container) => container.data.current?.type === 'board-slot')
    if(slot && pointerWithin({ ...args, droppableContainers: [slot] }).length && hintRef.current) return [{ id: slot.id }]
    const eligibleColumns = active.data.current?.hasChildren && active.data.current?.groupBy === 'status'
        ? columns.filter((column) => column.data.current?.groupId === active.data.current?.groupId)
        : columns
    const columnArgs = { ...args, droppableContainers: eligibleColumns }
    const columnId = pointerWithin(columnArgs)[0]?.id
    const column = columns.find((container) => container.id === columnId)
    if(!column) {
        hintRef.current = null
        return []
    }
    const groupId = column.data.current?.groupId
    let best = null
    for(const container of droppableContainers) {
        if(container.id === active.id) continue
        if(container.data.current?.type !== 'board-task') continue
        if(container.data.current?.groupId !== groupId) continue
        const rect = droppableRects.get(container.id)
        if(!rect) continue
        const center = rect.top + rect.height / 2
        const distance = Math.abs(pointerCoordinates.y - center)
        if(!best || distance < best.distance) best = { id: container.id, distance, below: pointerCoordinates.y > center }
    }
    hintRef.current = { groupId, overTaskId: best?.id ?? null, below: best?.below ?? false }
    return [{ id: best?.id ?? column.id }]
}

const BoardColumn = ({ meta, tasks, highlighted, children }) => {
    const { setNodeRef, isOver } = useDroppable({ id: `column:${meta.id}`, data: { groupId: meta.id } })
    const Icon = meta.icon
    return <section ref={setNodeRef} className={`flex h-full w-[min(300px,85vw)] min-w-[260px] shrink-0 snap-start flex-col rounded-2xl bg-neutral5/50 p-2 transition xl:flex-1 ${isOver || highlighted ? 'ring-1 ring-inset ring-neutral3' : ''}`}>
        <header className='mb-2 flex h-10 shrink-0 items-center gap-2 px-2 text-xs font-semibold'><Icon className='text-neutral1' /><h2 className='truncate'>{meta.label}</h2><span className='ml-auto text-neutral2'>{tasks.length}</span></header>
        <SortableContext items={tasks.map((task) => task.uid)} strategy={verticalListSortingStrategy}><div className='no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2'>{children}</div></SortableContext>
    </section>
}

const BoardDropSlot = ({ groupId, children }) => {
    const { setNodeRef } = useDroppable({ id: 'board-drop-slot', data: { type: 'board-slot', groupId } })
    return <div ref={setNodeRef} role='status' aria-label='Task placement preview' className='shrink-0'>{children}</div>
}

const AddBoardTask = ({ label, disabled, circles, courses, onAdd }) => {
    const ref = useRef(null)
    return <div className={`rounded-xl px-3 py-2.5 transition-colors focus-within:bg-neutral6 ${disabled ? 'pointer-events-none opacity-50' : 'hover:bg-neutral6'}`}><div className='flex items-center gap-2 text-neutral1'><FaPlus className='text-xs' /><TaskParsingInput inputRef={ref} title='' circles={circles} courses={courses} className='min-w-0 flex-1' placeholder={disabled ? 'Task limit reached' : `Add to ${label.toLowerCase()}`} clearOnEnter keepFocusOnEnter commitOnBlur={false} onCommit={onAdd} /></div></div>
}

const BoardTab = () => {
    const { profile, circleId, isCircleView = false, hideCircleWidgetControl = false, forceCircleWidget, agendaPreferences, saveAgendaPreferences } = useOutletContext()
    const { user, circle, commitTaskPatch, createTaskOptimistic, deleteTaskOptimistic } = useTasks()
    const circles = useCircles()
    const { courses, enrollments } = useCourses()
    const groupBy = agendaPreferences?.board?.groupBy || 'status'
    const tasks = useMemo(() => filterVisibleTasks({ userTasks: user, circleTasks: circle, isCircleView, circleId }), [circle, circleId, isCircleView, user])
    const { roots, childrenById } = useMemo(() => buildTaskTree(tasks), [tasks])
    const dropHintRef = useRef(null)
    const [activeId, setActiveId] = useState(null)
    const [placement, setPlacement] = useState(null)
    const [dragSize, setDragSize] = useState(null)
    const columnsRef = useRef([])
    const keyboardCoordinates = useCallback((event, { context, currentCoordinates }) => {
        if(!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) return
        event.preventDefault()
        const hint = dropHintRef.current
        const active = context.active
        if(!hint || !active) return
        const columns = columnsRef.current
        let columnIndex = columns.findIndex((column) => column.id === hint.groupId)
        const source = columns[columnIndex]
        const items = source.tasks.filter((task) => task.uid !== active.id)
        let slotIndex = hint.overTaskId ? items.findIndex((task) => task.uid === hint.overTaskId) + Number(hint.below) : items.length
        if(event.code === 'ArrowDown') slotIndex = Math.min(items.length, slotIndex + 1)
        if(event.code === 'ArrowUp') slotIndex = Math.max(0, slotIndex - 1)
        if(event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
            if(active.data.current?.hasChildren && active.data.current?.groupBy === 'status') return currentCoordinates
            columnIndex = Math.max(0, Math.min(columns.length - 1, columnIndex + (event.code === 'ArrowRight' ? 1 : -1)))
        }
        const column = columns[columnIndex]
        const destination = column.tasks.filter((task) => task.uid !== active.id)
        slotIndex = Math.min(slotIndex, destination.length)
        const nextHint = { groupId: column.id, overTaskId: destination[slotIndex]?.uid || null, below: false }
        dropHintRef.current = nextHint
        setPlacement(nextHint)
        const targetRect = context.droppableRects.get(nextHint.overTaskId || destination.at(-1)?.uid || `column:${column.id}`)
        return targetRect ? { x: targetRect.left, y: nextHint.overTaskId ? targetRect.top : destination.length ? targetRect.bottom + 8 : targetRect.top + 56 } : currentCoordinates
    }, [])
    const collisionDetection = useMemo(() => buildCollisionDetection(dropHintRef), [])
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }))
    const effectiveRoots = useMemo(() => {
        const statuses = deriveTreeStatuses(tasks)
        return roots.map((task) => ({ ...task, status: statuses.get(task.uid) || task.status }))
    }, [roots, tasks])
    const enrollmentColors = useMemo(() => new Map((enrollments || []).map((entry) => [String(entry.courseId), entry.customization?.color || '#9ca3af'])), [enrollments])
    const colorForTask = useCallback((task) => enrollmentColors.get(String(extractTaskTitleMetadata(task.title).courseId || '')) || '#9ca3af', [enrollmentColors])
    const columns = useMemo(() => buildColumns(effectiveRoots, groupBy, courses).map((meta) => ({ ...meta, tasks: sortBoardTasks(effectiveRoots.filter((task) => groupKey(task, groupBy) === meta.id)) })), [effectiveRoots, groupBy, courses])

    columnsRef.current = columns

    const createTask = useCallback((column, payload, parentTaskId = null) => {
        let title = titleForGroup(payload.title, groupBy, column.id, courses)
        if(isCircleView) title = forceCircleWidget?.(title) || title
        if(!flattenTaskTitle(title).trim()) return
        const siblings = parentTaskId ? childrenById.get(parentTaskId) || [] : roots.filter((task) => groupKey(task, groupBy) === column.id)
        const { taskId } = createTaskOptimistic({ title, userId: profile.uid, status: 'Incomplete', type: payload.metadata?.taskType || 'assignment', parentTaskId, siblingIndex: siblings.length, boardIndex: parentTaskId ? -1 : siblings.length, listIndex: tasks.length })
        if(taskId && groupBy === 'status' && column.id === 'In Progress') commitTaskPatch(taskId, { status: 'In Progress' }).catch(console.error)
    }, [childrenById, commitTaskPatch, courses, createTaskOptimistic, forceCircleWidget, groupBy, isCircleView, profile.uid, roots, tasks.length])
    const deleteTree = useCallback(async (taskId) => {
        await deleteTaskOptimistic(taskId)
    }, [deleteTaskOptimistic])
    const moveTask = useCallback(async (activeId, { groupId: destinationId, overTaskId, below }) => {
        const active = effectiveRoots.find((task) => task.uid === activeId)
        if(!active) return
        const sourceId = groupKey(active, groupBy)
        const hasChildren = (childrenById.get(activeId) || []).length > 0
        if(groupBy === 'status' && sourceId !== destinationId && hasChildren) return
        const previous = sortBoardTasks(effectiveRoots.filter((task) => groupKey(task, groupBy) === destinationId))
        const destination = insertBoardTask(previous, active, overTaskId, below)
        if(sourceId === destinationId && previous.length === destination.length && previous.every((task, position) => task.uid === destination[position].uid)) return
        const groupPatch = sourceId === destinationId ? null : groupBy === 'status'
            ? { status: destinationId }
            : { title: titleForGroup(active.title, groupBy, destinationId, courses) }
        await commitBoardMove(activeId, destination, groupPatch, commitTaskPatch)
    }, [childrenById, commitTaskPatch, courses, effectiveRoots, groupBy])
    const handleDragStart = useCallback(({ active }) => {
        const task = effectiveRoots.find((item) => item.uid === active.id)
        if(!task) return
        const source = columns.find((column) => column.id === groupKey(task, groupBy))
        const index = source.tasks.findIndex((item) => item.uid === task.uid)
        const hint = { groupId: source.id, overTaskId: source.tasks[index + 1]?.uid || null, below: false }
        dropHintRef.current = hint
        setPlacement(hint)
        const rect = active.data.current?.nodeRef?.current?.getBoundingClientRect() || active.rect.current.initial
        setDragSize(rect ? { width: rect.width, height: rect.height } : null)
        setActiveId(active.id)
    }, [columns, effectiveRoots, groupBy])
    const handleDragMove = useCallback(() => {
        const hint = dropHintRef.current
        setPlacement((previous) => previous?.groupId === hint?.groupId && previous?.overTaskId === hint?.overTaskId && previous?.below === hint?.below ? previous : hint)
    }, [])
    const handleDragCancel = useCallback(() => {
        dropHintRef.current = null
        setActiveId(null)
        setPlacement(null)
    }, [])
    const handleDragEnd = useCallback(({ active, over }) => {
        const hint = dropHintRef.current
        handleDragCancel()
        if(!over || !hint || hint.groupId === undefined || hint.groupId === null) return
        return moveTask(active.id, hint).catch(console.error)
    }, [handleDragCancel, moveTask])
    const activeTask = useMemo(() => effectiveRoots.find((task) => task.uid === activeId) || null, [activeId, effectiveRoots])

    const renderTask = (task, column) => <BoardTask key={task.uid} task={task} groupId={column.id} groupBy={groupBy} freezeLayout={Boolean(activeId)} childrenById={childrenById} circles={circles} courses={courses} courseColor={colorForTask(task)} hideCircleWidgets={hideCircleWidgetControl} onUpdate={commitTaskPatch} onDelete={deleteTree} onAddSubtask={(parent, payload) => createTask({ id: groupKey(parent, groupBy) }, payload, parent.uid)} />

    return <div className='flex h-full min-h-0 w-full flex-col gap-3'>
        <div className='flex h-11 shrink-0 items-center justify-end'><ViewOptionsButton view='board' preferences={agendaPreferences} onSave={saveAgendaPreferences} /></div>
        <DndContext sensors={sensors} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragOver={handleDragMove} onDragCancel={handleDragCancel} onDragEnd={handleDragEnd}>
            <div className={`no-scrollbar flex min-h-0 flex-1 gap-3 overflow-x-auto pb-3 ${activeId ? '' : 'snap-x snap-proximity'}`}>
                {columns.map((column) => {
                    const previewTasks = activeTask && placement?.groupId === column.id
                        ? insertBoardTask(column.tasks, activeTask, placement.overTaskId, placement.below)
                        : column.tasks.filter((task) => task.uid !== activeId)
                    return <BoardColumn key={column.id} meta={column} tasks={column.tasks} highlighted={placement?.groupId === column.id}>
                        {previewTasks.map((task) => task.uid === activeId
                            ? <BoardDropSlot key='placement' groupId={column.id}><BoardTaskGhost task={groupBy === 'status' ? { ...task, status: column.id } : { ...task, title: titleForGroup(task.title, groupBy, column.id, courses) }} courseColor={colorForTask(task)} groupBy={groupBy} placeholder height={dragSize?.height} /></BoardDropSlot>
                            : renderTask(task, column))}
                        {activeTask && column.tasks.some((task) => task.uid === activeId) && renderTask(activeTask, column)}
                        {!(groupBy === 'status' && column.id === 'Completed') && <AddBoardTask label={column.label} circles={circles} courses={courses} disabled={user.length >= MAX_USER_TASKS} onAdd={(payload) => createTask(column, payload)} />}
                    </BoardColumn>
                })}
            </div>
            <DragOverlay dropAnimation={null} style={dragSize ? { width: dragSize.width } : undefined} adjustScale={false}>{activeTask ? <BoardTaskGhost task={activeTask} courseColor={colorForTask(activeTask)} groupBy={groupBy} height={dragSize?.height} /> : null}</DragOverlay>
        </DndContext>
    </div>
}

export default BoardTab
