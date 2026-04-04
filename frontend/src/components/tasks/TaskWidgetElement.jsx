import { useCallback, useContext } from 'react'
import { ReactEditor, useSlateStatic } from 'slate-react'
import { Transforms } from 'slate'
import DatePicker from '../popovers/DatePicker.jsx'
import Dropdown from '../popovers/Dropdown.jsx'
import { TaskRowCompletionContext } from './ListTask.jsx'

const TaskWidgetElement = ({ attributes, children, element, isCompleted = false, circles = [], courses = [] }) => {

    const editor = useSlateStatic()
    const rowIsCompleted = useContext(TaskRowCompletionContext)
    const resolvedCompleted = rowIsCompleted || isCompleted
    const widgetType = element.segment?.widgetType || 'token'
    const label = element.segment?.rawText || element.segment?.displayText || widgetType

    const updateWidgetSegment = useCallback((nextSegment) => {
        try {
            const path = ReactEditor.findPath(editor, element)
            Transforms.setNodes(editor, { segment: nextSegment }, { at: path })
        } catch {
            // no-op when stale path
        }
    }, [editor, element])

    const baseChipClass = `mx-[1px] rounded-md px-1.5 py-[1px] text-sm bg-neutral5 hover:bg-neutral4 text-neutral0 transition ${resolvedCompleted ? 'opacity-60 line-through' : 'opacity-100'}`

    const preserveEditorSelectionOnMouseDown = (event) => {
        // Keep Slate focus/selection stable while still allowing click handlers
        // to run (for opening popovers and selecting chip-like controls).
        event.preventDefault()
    }

    if(widgetType === 'date') {
        const currentDate = element.segment?.value?.dueDate || ''
        const selectedDate = currentDate
            ? { seconds: Math.floor(new Date(`${currentDate}T00:00:00`).getTime() / 1000) }
            : -1

        return (
            <span {...attributes} contentEditable={false} className='inline-flex align-baseline'>
                <DatePicker
                    selectedDate={selectedDate}
                    onSelect={(date) => {
                        const nextDueDate = date === -1
                            ? ''
                            : new Date(date).toISOString().slice(0, 10)

                        updateWidgetSegment({
                            ...element.segment,
                            rawText: nextDueDate || label,
                            displayText: nextDueDate || label,
                            value: {
                                ...(element.segment?.value || {}),
                                dueDate: nextDueDate,
                            },
                        })
                    }}
                >
                    {(isOpen) => (
                        <button
                            type='button'
                            onMouseDown={preserveEditorSelectionOnMouseDown}
                            className={`${baseChipClass} inline-flex items-center cursor-pointer ${isOpen && 'bg-neutral4!'}`}
                        >
                            <span>{label}</span>
                        </button>
                    )}
                </DatePicker>
                {children}
            </span>
        )
    }

    if(widgetType === 'circle') {
        const options = [
            { uid: null, label: 'None', icon: null },
            ...circles.map((circle) => ({ uid: circle.uid, label: circle.title, icon: null })),
        ]

        return (
            <span {...attributes} contentEditable={false} className='inline-flex align-baseline'>
                <Dropdown
                    options={options}
                    isOptionSelected={(option) => {
                        const currentCircleId = element.segment?.value?.circleId || ''
                        if(option.uid === null) return !currentCircleId
                        return String(option.uid) === String(currentCircleId)
                    }}
                    onSelect={(option) => {
                        const chosenTitle = option?.uid
                            ? (circles.find((x) => x.uid === option.uid)?.title || option.label || label)
                            : 'None'

                        updateWidgetSegment({
                            ...element.segment,
                            rawText: chosenTitle,
                            displayText: chosenTitle,
                            value: {
                                ...(element.segment?.value || {}),
                                circleId: option?.uid || '',
                                title: chosenTitle,
                            },
                        })
                    }}
                >
                    {(isOpen) => (
                        <button
                            type='button'
                            onMouseDown={preserveEditorSelectionOnMouseDown}
                            className={`${baseChipClass} inline-flex items-center cursor-pointer ${isOpen && 'bg-neutral4!'}`}
                        >
                            <span>{label}</span>
                        </button>
                    )}
                </Dropdown>
                {children}
            </span>
        )
    }

    if(widgetType === 'course') {
        const options = courses.map((course) => ({
            uid: String(course.courseId),
            label: `${course.title}`,
            icon: null,
            course,
        }))

        return (
            <span {...attributes} contentEditable={false} className='inline-flex align-baseline'>
                <Dropdown
                    options={options.length ? options : [{ uid: null, label: 'No courses', icon: null }]}
                    isOptionSelected={(option) => String(option.uid || '') === String(element.segment?.value?.courseId || '')}
                    onSelect={(option) => {
                        if(!option?.uid) return
                        const course = option.course || courses.find((x) => String(x.courseId) === String(option.uid))
                        const courseTitle = course?.title || option.label || label

                        updateWidgetSegment({
                            ...element.segment,
                            rawText: courseTitle,
                            displayText: courseTitle,
                            value: {
                                ...(element.segment?.value || {}),
                                courseId: String(option.uid),
                                title: courseTitle,
                                subject: course?.subject || '',
                            },
                        })
                    }}
                >
                    {(isOpen) => (
                        <button
                            type='button'
                            onMouseDown={preserveEditorSelectionOnMouseDown}
                            className={`${baseChipClass} inline-flex items-center cursor-pointer ${isOpen && 'bg-neutral4!'}`}
                        >
                            <span>{label}</span>
                        </button>
                    )}
                </Dropdown>
                {children}
            </span>
        )
    }

    return (
        <span {...attributes} contentEditable={false} className='inline-flex align-baseline'>
            <span data-task-widget-chip className={baseChipClass}>
                {label}
            </span>
            {children}
        </span>
    )
}

export default TaskWidgetElement
