import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { FaChevronLeft, FaChevronRight, FaPlus, FaXmark } from 'react-icons/fa6'
import Button from '../../../shared/components/ui/Button'
import { useModal } from '../../../shared/contexts/ModalContext'
import { useTasks } from '../contexts/TasksContext'
import { useCircles } from '../../socials/contexts/CirclesContext'
import { useCourses } from '../../courses/contexts/CoursesContext'
import CalendarTask from '../components/CalendarTask'
import CalendarTaskModal from '../components/CalendarTaskModal'
import ViewOptionsButton from '../components/ViewOptionsButton'
import { extractTaskTitleMetadata, flattenTaskTitle, normalizeTaskTitle } from '../utils/naturalLanguage'
import { buildScheduleWidgetSegment, getWidgetSegment, removeWidget, upsertWidget } from '../utils/taskWidgetControlUtils'
import { addDays, buildCalendarDays, dateToIsoKey, startOfWeek } from '../utils/taskScheduleUtils'
import { buildTaskTree, filterVisibleTasks } from '../utils/taskViewUtils'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DRAG_TYPE = 'application/x-studium-task'
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
    const { openModal, closeModal } = useModal()
    const [mode, setMode] = useState('week')
    const [anchor, setAnchor] = useState(() => new Date())
    const [railOpen, setRailOpen] = useState(false)
    const [overflowDay, setOverflowDay] = useState(null)
    useEffect(() => {
        if(!railOpen && !overflowDay) return undefined
        const onKeyDown = (event) => { if(event.key === 'Escape') { setRailOpen(false); setOverflowDay(null) } }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [railOpen, overflowDay])
    const sortBy = agendaPreferences?.calendar?.sortBy || 'status'
    const tasks = useMemo(() => filterVisibleTasks({ userTasks: user, circleTasks: circle, isCircleView, circleId }), [circle, circleId, isCircleView, user])
    const { roots, childrenById } = useMemo(() => buildTaskTree(tasks), [tasks])
    const visibleDays = useMemo(() => buildCalendarDays(anchor, mode), [anchor, mode])
    const miniDays = useMemo(() => buildCalendarDays(anchor, 'month'), [anchor])
    const enrollmentColors = useMemo(() => new Map((enrollments || []).map((entry) => [String(entry.courseId), entry.customization?.color || '#9ca3af'])), [enrollments])
    const colorForTask = useCallback((task) => enrollmentColors.get(String(extractTaskTitleMetadata(task.title).courseId || '')) || '#9ca3af', [enrollmentColors])
    const byDate = useMemo(() => {
        const result = new Map()
        roots.forEach((task) => {
            const date = getWidgetSegment(task.title, 'date')?.value?.dueDate || ''
            if(!result.has(date)) result.set(date, [])
            result.get(date).push(task)
        })
        const compare = (a, b) => {
            if(sortBy === 'status') return (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0) || flattenTaskTitle(a.title).localeCompare(flattenTaskTitle(b.title))
            if(sortBy === 'course') return String(extractTaskTitleMetadata(a.title).courseTitle || '').localeCompare(String(extractTaskTitleMetadata(b.title).courseTitle || '')) || flattenTaskTitle(a.title).localeCompare(flattenTaskTitle(b.title))
            return flattenTaskTitle(a.title).localeCompare(flattenTaskTitle(b.title))
        }
        result.forEach((items) => items.sort(compare))
        return result
    }, [roots, sortBy])
    const unscheduled = byDate.get('') || []

    const setTaskDate = (task, dueDate) => commitTaskPatch(task.uid, { title: dueDate ? upsertWidget({ title: task.title, widgetType: 'date', builder: (current) => buildScheduleWidgetSegment({ currentSegment: current, dueDate, label: dueDate }) }) : removeWidget({ title: task.title, widgetType: 'date' }) })
    const createTask = (patch) => {
        let title = patch.title
        if(isCircleView) title = forceCircleWidget?.(title) || title
        const created = createTaskOptimistic({ title, userId: profile.uid, status: 'Incomplete', type: patch.type || 'assignment', parentTaskId: null, siblingIndex: roots.length, boardIndex: -1, listIndex: tasks.length })
        if(patch.status && patch.status !== 'Incomplete' && created?.taskId) commitTaskPatch(created.taskId, { status: patch.status }).catch(console.error)
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
    const openTask = (task) => openModal({
        content: <CalendarTaskModal task={task} children={childrenById.get(task.uid) || []} circles={circles} courses={courses} hideCircleWidgets={hideCircleWidgetControl} onSave={(patch) => task.isDraft ? createTask(patch) : commitTaskPatch(task.uid, patch)} onDelete={deleteTree} onAddSubtask={addSubtask} closeModal={closeModal} />,
        maxWidthClass: 'max-w-2xl mx-4',
    })
    const openNewTask = (dueDate = '') => {
        const segments = [{ type: 'text', rawText: '', displayText: '' }]
        if(dueDate) segments.push(buildScheduleWidgetSegment({ dueDate, label: dueDate }))
        openTask({ uid: 'draft', isDraft: true, title: normalizeTaskTitle({ segments }), status: 'Incomplete', type: 'assignment' })
    }
    const beginDrag = (event, task) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(DRAG_TYPE, task.uid) }
    const dropOnDate = (event, dueDate) => { event.preventDefault(); event.stopPropagation(); const task = roots.find((item) => item.uid === event.dataTransfer.getData(DRAG_TYPE)); if(task) setTaskDate(task, dueDate) }
    const navigate = (direction) => { const next = new Date(anchor); if(mode === 'month') next.setMonth(next.getMonth() + direction); else next.setDate(next.getDate() + direction * 7); setAnchor(next) }
    const renderTask = (task) => <CalendarTask key={task.uid} task={task} color={colorForTask(task)} onOpen={openTask} onDragStart={beginDrag} />
    const renderDayCell = (day, monthCell) => {
        const key = dateToIsoKey(day)
        const items = byDate.get(key) || []
        const today = key === dateToIsoKey(new Date())
        const limit = monthCell ? 2 : 8
        return <div key={key} onClick={() => openNewTask(key)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOnDate(event, key)} className={`min-h-0 overflow-hidden border-b border-r border-neutral4 p-1.5 ${monthCell && day.getMonth() !== anchor.getMonth() ? 'bg-neutral5/40' : 'bg-neutral6'}`}>
            {monthCell && <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${today ? 'bg-neutral0 text-neutral6' : ''}`}>{day.getDate()}</div>}
            <div className='space-y-1'>{items.slice(0, limit).map(renderTask)}{items.length > limit && <button type='button' onClick={(event) => { event.stopPropagation(); setOverflowDay(key) }} className='px-1 text-xs font-semibold text-neutral1 hover:text-neutral0'>+{items.length - limit} more</button>}</div>
        </div>
    }
    const sideRail = <aside className={`flex h-full min-h-0 flex-col gap-4 rounded-xl border border-neutral4 bg-neutral6 p-3 lg:w-52 lg:shrink-0 ${railOpen ? 'fixed inset-y-4 right-4 z-50 w-72 shadow-xl' : 'hidden lg:flex'}`}>
        <div className='flex items-center justify-between'><h3 className='text-sm font-semibold'>{anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3><button type='button' className='lg:hidden' onClick={() => setRailOpen(false)} aria-label='Close calendar rail'><FaXmark /></button></div>
        <div className='grid grid-cols-7 text-center text-[10px] text-neutral1'>{WEEKDAYS.map((day) => <span key={day}>{day[0]}</span>)}</div>
        <div className='grid grid-cols-7 gap-0.5'>{miniDays.map((day) => { const key = dateToIsoKey(day); return <button key={key} type='button' onClick={() => { setAnchor(day); setRailOpen(false) }} className={`aspect-square rounded-md text-[10px] hover:bg-neutral5 ${key === dateToIsoKey(anchor) ? 'bg-neutral0 text-neutral6' : day.getMonth() !== anchor.getMonth() ? 'text-neutral2' : ''}`}>{day.getDate()}</button> })}</div>
        <div className='flex min-h-0 flex-1 flex-col border-t border-neutral4 pt-3'><div className='mb-2 flex items-center justify-between text-xs font-semibold'><span>Unscheduled</span><span className='text-neutral1'>{unscheduled.length}</span></div><div onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOnDate(event, '')} className='no-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto'>{unscheduled.map((task) => <button key={task.uid} type='button' draggable onDragStart={(event) => beginDrag(event, task)} onClick={() => openTask(task)} className='w-full truncate rounded-lg bg-neutral5 px-2 py-1.5 text-left text-xs'>{flattenTaskTitle(task.title) || 'Untitled task'}</button>)}</div><button type='button' onClick={() => openNewTask()} className='mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-neutral3 px-2 py-2 text-xs font-semibold text-neutral1'><FaPlus /> Task</button></div>
    </aside>

    return <div className='flex h-full min-h-0 w-full flex-col gap-3'>
        <div className='flex shrink-0 flex-wrap items-center gap-2'><div className='flex items-center'><Button type='tertiary' className='!p-2' aria-label='Previous' onClick={() => navigate(-1)}><FaChevronLeft /></Button><Button type='tertiary' className='!p-2' aria-label='Next' onClick={() => navigate(1)}><FaChevronRight /></Button><Button onClick={() => setAnchor(new Date())}>Today</Button></div><h2 className='order-first w-full text-base font-semibold sm:order-none sm:min-w-0 sm:flex-1 sm:px-2'>{formatRangeTitle(anchor, mode)}</h2><button type='button' className='rounded-lg border border-neutral4 px-3 py-2 text-xs lg:hidden' onClick={() => setRailOpen(true)}>Mini · Inbox {unscheduled.length}</button><div className='flex rounded-full bg-neutral5 p-1'>{['week', 'month'].map((value) => <button key={value} type='button' onClick={() => setMode(value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${mode === value ? 'bg-neutral6 shadow-sm' : 'text-neutral1'}`}>{value}</button>)}</div><ViewOptionsButton preferences={agendaPreferences} onSave={saveAgendaPreferences} /></div>
        <div className='flex min-h-0 flex-1 gap-3'>{sideRail}<div className='no-scrollbar min-h-0 min-w-0 flex-1 overflow-x-auto'>{mode === 'month' ? <div className='flex h-full min-w-[620px] flex-col overflow-hidden rounded-xl border border-neutral4'><div className='grid grid-cols-7 border-b border-neutral4 bg-neutral5/50'>{WEEKDAYS.map((day) => <div key={day} className='py-2 text-center text-xs font-semibold text-neutral1'>{day}</div>)}</div><div className='grid min-h-0 flex-1 grid-cols-7 grid-rows-6'>{visibleDays.map((day) => renderDayCell(day, true))}</div></div> : <div className='grid h-full min-w-[620px] grid-cols-7 overflow-hidden rounded-xl border border-neutral4'>{visibleDays.map((day) => <div key={dateToIsoKey(day)} className='min-w-0 overflow-hidden border-r border-neutral4'><div className='border-b border-neutral4 bg-neutral5/35 py-2 text-center text-xs font-semibold'>{day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</div>{renderDayCell(day, false)}</div>)}</div>}</div></div>
        {railOpen && <button type='button' aria-label='Close side rail' className='fixed inset-0 z-40 bg-black/30 lg:hidden' onClick={() => setRailOpen(false)} />}
        {overflowDay && <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4' onClick={() => setOverflowDay(null)}><div role='dialog' aria-label={`Tasks on ${overflowDay}`} className='max-h-[70vh] w-full max-w-sm overflow-y-auto rounded-xl bg-neutral6 p-4 shadow-xl' onClick={(event) => event.stopPropagation()}><div className='mb-3 flex items-center justify-between'><h3 className='font-semibold'>{overflowDay}</h3><button type='button' onClick={() => setOverflowDay(null)} aria-label='Close'><FaXmark /></button></div><div className='space-y-2'>{(byDate.get(overflowDay) || []).map(renderTask)}</div></div></div>}
    </div>
}

export default CalendarTab
