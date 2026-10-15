import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, rectIntersection, useSensor, useSensors } from '@dnd-kit/core'
import { useOutletContext } from 'react-router-dom'
import { FaArrowDown, FaCalendarDays, FaPlus, FaXmark } from 'react-icons/fa6'
import useToday from '../../../shared/hooks/useToday'
import MiniCalendar from '../../../shared/components/ui/MiniCalendar'
import TextTabSelector from '../../../shared/components/ui/TextTabSelector'
import { useTasks } from '../contexts/TasksContext'
import { useCircles } from '../../socials/contexts/CirclesContext'
import { useCourses } from '../../courses/contexts/CoursesContext'
import CalendarTask, { CalendarTaskGhost } from '../components/CalendarTask'
import CalendarDropZone from '../components/CalendarDropZone'
import CalendarTaskDetails from '../components/CalendarTaskDetails'
import CalendarTaskPopover from '../components/CalendarTaskPopover'
import ViewOptionsButton from '../components/ViewOptionsButton'
import { extractTaskTitleMetadata, flattenTaskTitle, normalizeTaskTitle } from '../utils/naturalLanguage'
import { buildScheduleWidgetSegment, getWidgetSegment, removeWidget, upsertWidget } from '../utils/taskWidgetControlUtils'
import { addDays, buildCalendarDays, dateToIsoKey, startOfWeek } from '../utils/taskScheduleUtils'
import { buildTaskTree, deriveTreeStatuses, filterVisibleTasks } from '../utils/taskViewUtils'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const STATUS_ORDER = { Incomplete: 0, 'In Progress': 1, Completed: 2 }
const formatRangeTitle = (anchor, mode) => {
    if(mode === 'month') return anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    const start = startOfWeek(anchor)
    const end = addDays(start, 6)
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
}

const CalendarTab = () => {
    const { profile, circleId, isCircleView = false, hideCircleWidgetControl = false, forceCircleWidget, agendaPreferences, saveAgendaPreferences } = useOutletContext()
    const { user, circle, commitTaskPatch, createTaskOptimistic, deleteTaskOptimistic } = useTasks()
    const circles = useCircles()
    const { courses, enrollments } = useCourses()
    const today = useToday()
    const [mode, setMode] = useState('week')
    const [anchor, setAnchor] = useState(() => new Date())
    const [miniMonth, setMiniMonth] = useState(() => new Date())
    const [dropTarget, setDropTarget] = useState(null)
    const [railOpen, setRailOpen] = useState(false)
    const [overflowDay, setOverflowDay] = useState(null)
    const [selection, setSelection] = useState(null)
    const [activeTaskId, setActiveTaskId] = useState(null)
    const [dragWidth, setDragWidth] = useState(null)
    const [moveError, setMoveError] = useState('')
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor))
    useEffect(() => {
        if(!railOpen && !overflowDay) return undefined
        const onKeyDown = (event) => { if(event.key === 'Escape') { setRailOpen(false); setOverflowDay(null) } }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [railOpen, overflowDay])
    const sortBy = agendaPreferences?.calendar?.sortBy || 'status'
    const tasks = useMemo(() => filterVisibleTasks({ userTasks: user, circleTasks: circle, isCircleView, circleId }), [circle, circleId, isCircleView, user])
    const { roots, childrenById } = useMemo(() => buildTaskTree(tasks), [tasks])
    const statuses = useMemo(() => deriveTreeStatuses(tasks), [tasks])
    const selectedTask = selection?.task.isDraft ? selection.task : tasks.find((task) => task.uid === selection?.task.uid)
    const closeTask = useCallback(() => setSelection(null), [])
    const visibleDays = useMemo(() => buildCalendarDays(anchor, mode), [anchor, mode])
    const enrollmentColors = useMemo(() => new Map((enrollments || []).map((entry) => [String(entry.courseId), entry.customization?.color || '#9ca3af'])), [enrollments])
    const courseNames = useMemo(() => new Map((courses || []).map((course) => [String(course.courseId), course.title])), [courses])
    const colorForTask = useCallback((task) => enrollmentColors.get(String(extractTaskTitleMetadata(task.title).courseId || '')) || '#9ca3af', [enrollmentColors])
    const byDate = useMemo(() => {
        const result = new Map()
        roots.forEach((task) => {
            const date = getWidgetSegment(task.title, 'date')?.value?.dueDate || ''
            if(!result.has(date)) result.set(date, [])
            result.get(date).push({ ...task, status: statuses.get(task.uid) || task.status })
        })
        const courseName = (task) => {
            const widget = getWidgetSegment(task.title, 'course')
            return courseNames.get(String(widget?.value?.courseId || '')) || widget?.value?.title || widget?.rawText || ''
        }
        const compare = (a, b) => {
            if(sortBy === 'status') return (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0) || flattenTaskTitle(a.title).localeCompare(flattenTaskTitle(b.title))
            if(sortBy === 'course') return courseName(a).localeCompare(courseName(b)) || flattenTaskTitle(a.title).localeCompare(flattenTaskTitle(b.title))
            return flattenTaskTitle(a.title).localeCompare(flattenTaskTitle(b.title))
        }
        result.forEach((items) => items.sort(compare))
        return result
    }, [courseNames, roots, sortBy, statuses])
    const unscheduled = byDate.get('') || []
    const activeTask = roots.find((task) => task.uid === activeTaskId)

    const setTaskDate = (task, dueDate) => commitTaskPatch(task.uid, { title: dueDate ? upsertWidget({ title: task.title, widgetType: 'date', builder: (current) => buildScheduleWidgetSegment({ currentSegment: current, dueDate, label: dueDate }) }) : removeWidget({ title: task.title, widgetType: 'date' }) })
    const createTask = (patch) => {
        let title = patch.title
        if(isCircleView) title = forceCircleWidget?.(title) || title
        const created = createTaskOptimistic({ title, userId: profile.uid, status: 'Incomplete', type: patch.type || 'assignment', parentTaskId: null, siblingIndex: roots.length, boardIndex: -1, listIndex: tasks.length })
        if(!created?.taskId) throw new Error('Task limit reached')
        if(patch.status && patch.status !== 'Incomplete') return commitTaskPatch(created.taskId, { status: patch.status })
    }
    const deleteTree = async (taskId) => {
        await deleteTaskOptimistic(taskId)
    }
    const addSubtask = (parent, payload) => {
        let title = payload.title
        if(isCircleView) title = forceCircleWidget?.(title) || title
        if(!flattenTaskTitle(title).trim()) return
        createTaskOptimistic({ title, userId: profile.uid, status: 'Incomplete', type: payload.metadata?.taskType || 'assignment', parentTaskId: parent.uid, siblingIndex: (childrenById.get(parent.uid) || []).length, boardIndex: -1, listIndex: tasks.length })
    }
    const openTask = (task, anchor) => setSelection({ task, anchor })
    const openNewTask = (dueDate = '', anchor) => {
        const segments = [{ type: 'text', rawText: '', displayText: '' }]
        if(dueDate) segments.push(buildScheduleWidgetSegment({ dueDate, label: dueDate }))
        openTask({ uid: 'draft', isDraft: true, title: normalizeTaskTitle({ segments }), status: 'Incomplete', type: 'assignment' }, anchor)
    }
    const beginDrag = ({ active }) => {
        setActiveTaskId(active.data.current?.taskId)
        setDragWidth(active.rect.current.initial?.width || 180)
        setSelection(null)
        setMoveError('')
    }
    const cancelDrag = () => { setActiveTaskId(null); setDropTarget(null); setDragWidth(null) }
    const finishDrag = ({ active, over }) => {
        const task = roots.find((task) => task.uid === active.data.current?.taskId)
        const dueDate = over?.data.current?.dueDate
        cancelDrag()
        if(!task || typeof dueDate !== 'string' || (getWidgetSegment(task.title, 'date')?.value?.dueDate || '') === dueDate) return
        setRailOpen(false)
        setOverflowDay(null)
        setTaskDate(task, dueDate).catch(() => setMoveError('Could not move this task. Please try again.'))
    }
    const collisionDetection = (args) => args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args)
    const renderPlacement = (dueDate) => activeTask && dropTarget === dueDate && (getWidgetSegment(activeTask.title, 'date')?.value?.dueDate || '') !== dueDate
        ? <CalendarTaskGhost task={{ ...activeTask, status: statuses.get(activeTask.uid) || activeTask.status }} color={colorForTask(activeTask)} placeholder /> : null
    const selectDate = (day) => { setAnchor(day); setMiniMonth(day) }
    const navigateMiniMonth = (next) => {
        setMiniMonth(next)
        if(mode === 'month') setAnchor(next)
    }
    const todayKey = dateToIsoKey(today)
    const renderTask = (task) => <CalendarTask key={task.uid} task={task} color={colorForTask(task)} onOpen={openTask} />
    const renderDayCell = (day, monthCell) => {
        const key = dateToIsoKey(day)
        const items = byDate.get(key) || []
        const today = key === todayKey
        const limit = monthCell ? 2 : items.length
        return <CalendarDropZone key={key} dueDate={key} className={`group/day no-scrollbar flex min-h-0 flex-col overflow-y-auto p-2 transition-colors ${monthCell ? 'border-b border-r border-neutral4 [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0' : 'flex-1'} ${dropTarget === key ? 'bg-neutral5 ring-1 ring-inset ring-neutral2' : monthCell && day.getMonth() !== anchor.getMonth() ? 'bg-neutral5 text-neutral2' : 'bg-neutral6 hover:bg-neutral5/20'}`}>
            {monthCell && <div className={`mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${today ? 'bg-neutral0 text-neutral6' : ''}`}>{day.getDate()}</div>}
            <div className='space-y-1'>{items.slice(0, limit).map(renderTask)}{renderPlacement(key)}{items.length > limit && <button type='button' onClick={(event) => { event.stopPropagation(); setOverflowDay(key) }} className='px-1 text-xs font-semibold text-neutral1 hover:text-neutral0'>+{items.length - limit} more</button>}</div>
            <button type='button' aria-label={`Add task on ${day.toLocaleDateString(undefined, { dateStyle: 'full' })}`} onClick={(event) => { event.stopPropagation(); openNewTask(key, event.currentTarget) }} className={`mt-1 flex min-h-6 w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-neutral4/40 px-2 text-left text-xs text-neutral1 opacity-0 transition-[opacity,background-color] duration-150 hover:bg-neutral4/70 group-hover/day:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-neutral2 pointer-coarse:opacity-100 ${dropTarget === key ? 'opacity-100' : ''}`}>
                {dropTarget === key ? <FaArrowDown className='text-[10px]' /> : <FaPlus className='text-[10px]' />}<span className={monthCell ? 'hidden sm:inline' : ''}>{dropTarget === key ? 'Move here' : 'Add task'}</span>
            </button>
        </CalendarDropZone>
    }
    const sideRail = <aside className={`flex min-h-0 flex-col gap-5 bg-neutral6 py-2 lg:w-48 lg:shrink-0 ${railOpen ? 'fixed inset-y-4 right-4 z-50 w-72 rounded-2xl border border-neutral4 p-4 shadow-xl' : 'hidden h-full lg:flex'}`}>
        <MiniCalendar month={miniMonth} selectedDate={mode === 'month' ? anchor : today} viewedWeek={mode === 'week' ? anchor : undefined} onMonthChange={navigateMiniMonth} onSelect={(day) => { selectDate(day); setRailOpen(false) }} headerAction={<button type='button' className='lg:hidden' onClick={() => setRailOpen(false)} aria-label='Close calendar rail'><FaXmark /></button>} />
        <div className='flex min-h-0 flex-1 flex-col border-t border-neutral4 pt-4'>
            <div className='mb-3 flex items-center justify-between text-xs font-semibold text-neutral1'><span>Unscheduled</span><span className='text-neutral2'>{unscheduled.length}</span></div>
            <CalendarDropZone dueDate='' className={`no-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg transition-colors ${dropTarget === '' ? 'bg-neutral5 ring-1 ring-inset ring-neutral2' : ''}`}>
                {unscheduled.map(renderTask)}{renderPlacement('')}
                <button type='button' onClick={(event) => { event.stopPropagation(); openNewTask('', event.currentTarget) }} className='flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-neutral2 transition-[background-color] duration-150 hover:bg-neutral5'><FaPlus className='text-[10px]' />Add task</button>
            </CalendarDropZone>
        </div>
    </aside>

    return <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={beginDrag} onDragOver={({ over }) => setDropTarget(over?.data.current?.dueDate ?? null)} onDragCancel={cancelDrag} onDragEnd={finishDrag}><div className='flex h-full min-h-0 w-full flex-col gap-4'>
        <div className='flex shrink-0 flex-wrap items-center gap-3'>
            <h2 className='order-first w-full text-base font-semibold sm:order-none sm:min-w-0 sm:flex-1'>{formatRangeTitle(anchor, mode)}</h2>
            <button type='button' aria-label='Open mini calendar' className='flex size-9 items-center justify-center rounded-full text-neutral1 hover:bg-neutral5 lg:hidden' onClick={() => setRailOpen(true)}><FaCalendarDays className='text-sm' /></button>
            <TextTabSelector tabs={[{ name: 'week', label: 'Week' }, { name: 'month', label: 'Month' }]} currentIndex={mode === 'week' ? 0 : 1} onSelect={(tab) => { setMode(tab.name); setMiniMonth(anchor) }} />
            <ViewOptionsButton view='calendar' preferences={agendaPreferences} onSave={saveAgendaPreferences} />
        </div>
        {moveError && <p role='alert' className='text-xs text-red-400'>{moveError}</p>}
        <div className='flex min-h-0 flex-1 gap-6'>{sideRail}<div className='no-scrollbar min-h-0 min-w-0 flex-1 overflow-x-auto'>{mode === 'month' ? <div className='flex h-full min-w-[620px] flex-col overflow-hidden rounded-xl border border-neutral4'><div className='grid grid-cols-7 border-b border-neutral4'>{WEEKDAYS.map((day) => <div key={day} className='py-3 text-center text-xs text-neutral1'>{day}</div>)}</div><div className='grid min-h-0 flex-1 grid-cols-7 grid-rows-6'>{visibleDays.map((day) => renderDayCell(day, true))}</div></div> : <div className='grid h-full min-w-[620px] grid-cols-7 overflow-hidden rounded-xl border border-neutral4'>{visibleDays.map((day) => <CalendarDropZone key={dateToIsoKey(day)} dueDate={dateToIsoKey(day)} className='flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-neutral4 last:border-r-0'><div className='flex shrink-0 flex-col items-center gap-1 border-b border-neutral4 py-3'><span className='text-[10px] text-neutral1'>{day.toLocaleDateString(undefined, { weekday: 'short' })}</span><span className={`flex size-7 items-center justify-center rounded-full text-sm ${dateToIsoKey(day) === todayKey ? 'bg-neutral0 text-neutral6' : ''}`}>{day.getDate()}</span></div>{renderDayCell(day, false)}</CalendarDropZone>)}</div>}</div></div>
        {railOpen && !activeTask && <button type='button' aria-label='Close side rail' className='fixed inset-0 z-40 bg-black/30 lg:hidden' onClick={() => setRailOpen(false)} />}
        {overflowDay && <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${activeTask ? 'pointer-events-none opacity-40' : 'bg-black/30'}`} onClick={() => setOverflowDay(null)}><div role='dialog' aria-label={`Tasks on ${overflowDay}`} className='max-h-[70vh] w-full max-w-sm overflow-y-auto rounded-xl bg-neutral6 p-4 shadow-xl' onClick={(event) => event.stopPropagation()}><div className='mb-3 flex items-center justify-between'><h3 className='font-semibold'>{overflowDay}</h3><button type='button' onClick={() => setOverflowDay(null)} aria-label='Close'><FaXmark /></button></div><div className='space-y-2'>{(byDate.get(overflowDay) || []).map(renderTask)}</div></div></div>}
        {selectedTask && <CalendarTaskPopover key={selectedTask.uid === 'draft' ? `draft:${getWidgetSegment(selectedTask.title, 'date')?.value?.dueDate || ''}` : selectedTask.uid} anchor={selection.anchor} onClose={closeTask}>
            <CalendarTaskDetails task={{ ...selectedTask, status: statuses.get(selectedTask.uid) || selectedTask.status }} childrenById={childrenById} circles={circles} courses={courses} courseColor={colorForTask(selectedTask)} hideCircleWidgets={hideCircleWidgetControl} onSave={selectedTask.isDraft ? createTask : (patch) => commitTaskPatch(selectedTask.uid, patch)} onUpdate={commitTaskPatch} onDelete={deleteTree} onAddSubtask={addSubtask} onClose={closeTask} />
        </CalendarTaskPopover>}
        {createPortal(<DragOverlay dropAnimation={null} zIndex={5000} style={{ width: dragWidth || undefined }}>{activeTask ? <CalendarTaskGhost task={{ ...activeTask, status: statuses.get(activeTask.uid) || activeTask.status }} color={colorForTask(activeTask)} /> : null}</DragOverlay>, document.body)}
    </div></DndContext>
}

export default CalendarTab
