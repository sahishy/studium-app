import { useCallback, useMemo, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { FaCheckCircle, FaClock, FaDotCircle, FaBook, FaCalendar } from 'react-icons/fa'
import { FaPlus } from 'react-icons/fa6'
import BoardTask from '../components/BoardTask'
import TaskParsingInput from '../components/TaskParsingInput'
import ViewOptionsButton from '../components/ViewOptionsButton'
import { useTasks } from '../contexts/TasksContext'
import { useCircles } from '../../socials/contexts/CirclesContext'
import { useCourses } from '../../courses/contexts/CoursesContext'
import { MAX_USER_TASKS } from '../utils/taskUtils'
import { extractTaskTitleMetadata, flattenTaskTitle } from '../utils/naturalLanguage'
import { buildTaskTree, deriveTreeStatuses, filterVisibleTasks, sortBoardTasks } from '../utils/taskViewUtils'
import { buildCourseWidgetSegment, buildScheduleWidgetSegment, removeWidget, upsertWidget } from '../utils/taskWidgetControlUtils'
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

const BoardColumn = ({ meta, tasks, children }) => {
    const { setNodeRef, isOver } = useDroppable({ id: `column:${meta.id}`, data: { groupId: meta.id } })
    const Icon = meta.icon
    return <section ref={setNodeRef} className={`flex h-full w-[min(340px,85vw)] shrink-0 flex-col rounded-xl border border-neutral4 bg-neutral5/40 p-3 transition ${isOver ? 'ring-2 ring-neutral2' : ''}`}>
        <header className='flex h-10 items-center gap-2 px-2 text-sm font-semibold'><Icon className='text-neutral1' /><h2 className='truncate'>{meta.label}</h2><span className='text-neutral1'>{tasks.length}</span></header>
        <SortableContext items={tasks.map((task) => task.uid)} strategy={verticalListSortingStrategy}><div className='no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-3'>{children}</div></SortableContext>
    </section>
}

const AddBoardTask = ({ label, disabled, circles, courses, onAdd }) => {
    const ref = useRef(null)
    return <div className={`rounded-xl border border-dashed border-neutral3 px-4 py-3 focus-within:bg-neutral6 ${disabled ? 'pointer-events-none opacity-50' : 'hover:bg-neutral6'}`}><div className='flex items-center gap-2 text-neutral1'><FaPlus className='text-xs' /><TaskParsingInput inputRef={ref} title='' circles={circles} courses={courses} className='min-w-0 flex-1' placeholder={disabled ? 'Task limit reached' : `Add to ${label.toLowerCase()}`} clearOnEnter keepFocusOnEnter commitOnBlur={false} onCommit={onAdd} /></div></div>
}

const BoardTab = () => {
    const { profile, circleId, isCircleView = false, hideCircleWidgetControl = false, forceCircleWidget, agendaPreferences, saveAgendaPreferences } = useOutletContext()
    const { user, circle, commitTaskPatch, createTaskOptimistic, deleteTaskOptimistic } = useTasks()
    const circles = useCircles()
    const { courses, enrollments } = useCourses()
    const groupBy = agendaPreferences?.board?.groupBy || 'status'
    const tasks = useMemo(() => filterVisibleTasks({ userTasks: user, circleTasks: circle, isCircleView, circleId }), [circle, circleId, isCircleView, user])
    const { roots, childrenById } = useMemo(() => buildTaskTree(tasks), [tasks])
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
    const effectiveRoots = useMemo(() => {
        const statuses = deriveTreeStatuses(tasks)
        return roots.map((task) => ({ ...task, status: statuses.get(task.uid) || task.status }))
    }, [roots, tasks])
    const enrollmentColors = useMemo(() => new Map((enrollments || []).map((entry) => [String(entry.courseId), entry.customization?.color || '#9ca3af'])), [enrollments])
    const colorForTask = useCallback((task) => enrollmentColors.get(String(extractTaskTitleMetadata(task.title).courseId || '')) || '#9ca3af', [enrollmentColors])
    const columns = useMemo(() => buildColumns(effectiveRoots, groupBy, courses).map((meta) => ({ ...meta, tasks: sortBoardTasks(effectiveRoots.filter((task) => groupKey(task, groupBy) === meta.id)) })), [effectiveRoots, groupBy, courses])

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
    const moveTask = useCallback(async (activeId, destinationId, overTaskId = null) => {
        const active = effectiveRoots.find((task) => task.uid === activeId)
        if(!active) return
        const sourceId = groupKey(active, groupBy)
        if(groupBy === 'status' && sourceId !== destinationId && (childrenById.get(activeId) || []).length) return
        const destination = sortBoardTasks(effectiveRoots.filter((task) => task.uid !== activeId && groupKey(task, groupBy) === destinationId))
        const index = overTaskId ? destination.findIndex((task) => task.uid === overTaskId) : -1
        destination.splice(index < 0 ? destination.length : index, 0, active)
        await Promise.all(destination.map((task, boardIndex) => commitTaskPatch(task.uid, { boardIndex })))
        if(sourceId === destinationId) return
        if(groupBy === 'status' && !(childrenById.get(activeId) || []).length) await commitTaskPatch(activeId, { status: destinationId })
        else await commitTaskPatch(activeId, { title: titleForGroup(active.title, groupBy, destinationId, courses) })
    }, [childrenById, commitTaskPatch, courses, effectiveRoots, groupBy])
    const handleDragEnd = useCallback(({ active, over }) => {
        if(!over) return
        const target = effectiveRoots.find((task) => task.uid === over.id)
        const destinationId = over.data.current?.groupId ?? (target ? groupKey(target, groupBy) : null)
        if(destinationId === null) return
        return moveTask(active.id, destinationId, target?.uid)
    }, [effectiveRoots, groupBy, moveTask])

    return <div className='flex h-[calc(100vh-190px)] min-h-0 w-full flex-col gap-3'><div className='flex h-11 shrink-0 items-center justify-end'><ViewOptionsButton preferences={agendaPreferences} onSave={saveAgendaPreferences} /></div><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><div className='no-scrollbar flex min-h-0 flex-1 gap-3 overflow-x-auto pb-3'>{columns.map((column) => <BoardColumn key={column.id} meta={column} tasks={column.tasks}>{column.tasks.map((task) => <BoardTask key={task.uid} task={task} childrenById={childrenById} circles={circles} courses={courses} courseColor={colorForTask(task)} hideCircleWidgets={hideCircleWidgetControl} onUpdate={commitTaskPatch} onDelete={deleteTree} onAddSubtask={(parent, payload) => createTask({ id: groupKey(parent, groupBy) }, payload, parent.uid)} />)}{!(groupBy === 'status' && column.id === 'Completed') && <AddBoardTask label={column.label} circles={circles} courses={courses} disabled={user.length >= MAX_USER_TASKS} onAdd={(payload) => createTask(column, payload)} />}</BoardColumn>)}</div></DndContext></div>
}

export default BoardTab
