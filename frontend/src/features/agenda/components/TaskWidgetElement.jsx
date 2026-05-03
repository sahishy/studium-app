import { useCallback } from 'react'
import { ReactEditor, useSlateStatic } from 'slate-react'
import { Transforms } from 'slate'
import DatePicker from '../../../shared/components/popovers/DatePicker'
import Select from '../../../shared/components/popovers/Select'
import { formatRelativeTaskDate } from '../../../shared/utils/formatters'
import { resolveTaskDateWidgetLabel } from '../utils/taskDateDisplayUtils'
import { isTitleMostlyLowercase } from '../utils/taskParsingSlateUtils'

const formatLocalDateKey = (value) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

// prevent editor from losing selection when clicking widget button
const preventEditorBlur = (event) => event.preventDefault()

const TaskWidgetElement = ({ attributes, children, element, isCompleted = false, circles = [], courses = [], onWidgetCommit, inverted }) => {

    const editor = useSlateStatic()
    const widgetType = element.segment?.widgetType || 'token'
    const label = element.segment?.rawText || element.segment?.displayText || widgetType

    const updateWidgetSegment = useCallback((nextSegment) => {
        try {
            const path = ReactEditor.findPath(editor, element)
            Transforms.setNodes(editor, { segment: nextSegment }, { at: path })
            onWidgetCommit?.()
        } catch {
            // element removed before update fired
        }
    }, [editor, element, onWidgetCommit])

    const baseChipClass = `mx-[1px] rounded-md px-1.5 py-0.5 text-sm text-neutral0 transition inline-flex items-center cursor-pointer ${isCompleted ? 'opacity-40 line-through' : 'opacity-100'}`
    const chipClass = `${baseChipClass} ${inverted ? 'bg-neutral6 hover:bg-neutral6/60' : 'bg-neutral5 hover:bg-neutral4'}`
    const chipOpenClass = inverted ? 'bg-neutral6/80!' : 'bg-neutral4!'

    if (widgetType === 'date') {
        const currentDate = element.segment?.value?.dueDate || ''
        const dynamicLabel = resolveTaskDateWidgetLabel({ editor, element, rawLabel: label, dueDate: currentDate })
        const selectedDate = currentDate
            ? { seconds: Math.floor(new Date(`${currentDate}T00:00:00`).getTime() / 1000) }
            : -1

        return (
            <span {...attributes} contentEditable={false} className='inline-flex align-baseline'>
                <DatePicker
                    selectedDate={selectedDate}
                    onSelect={(date) => {
                        const nextDueDate = date === -1 ? '' : formatLocalDateKey(date)
                        const nextDateLabel = nextDueDate
                            ? formatRelativeTaskDate(nextDueDate, { fallbackLabel: nextDueDate })
                            : ''
                        const resolvedLabel = isTitleMostlyLowercase(label)
                            ? nextDateLabel.toLowerCase()
                            : nextDateLabel

                        updateWidgetSegment({
                            ...element.segment,
                            rawText: resolvedLabel || label,
                            displayText: resolvedLabel || label,
                            value: { ...(element.segment?.value || {}), dueDate: nextDueDate },
                        })
                    }}
                >
                    {(isOpen) => (
                        <button
                            type='button'
                            onMouseDown={preventEditorBlur}
                            className={`${chipClass} ${isOpen && chipOpenClass}`}
                        >
                            <span>{dynamicLabel || label}</span>
                        </button>
                    )}
                </DatePicker>
                {children}
            </span>
        )
    }

    if (widgetType === 'circle') {
        const options = [
            { uid: null, label: 'None', icon: null },
            ...circles.map((circle) => ({ uid: circle.uid, label: circle.title, icon: null })),
        ]

        return (
            <span {...attributes} contentEditable={false} className='inline-flex align-baseline'>
                <Select
                    options={options}
                    isOptionSelected={(option) => {
                        const currentCircleId = element.segment?.value?.circleId || ''
                        return option.uid === null ? !currentCircleId : String(option.uid) === String(currentCircleId)
                    }}
                    onSelect={(option) => {
                        const chosenTitle = option?.uid
                            ? (circles.find((x) => x.uid === option.uid)?.title || option.label || label)
                            : 'None'

                        updateWidgetSegment({
                            ...element.segment,
                            rawText: chosenTitle,
                            displayText: chosenTitle,
                            value: { ...(element.segment?.value || {}), circleId: option?.uid || '', title: chosenTitle },
                        })
                    }}
                >
                    {(isOpen) => (
                        <button
                            type='button'
                            onMouseDown={preventEditorBlur}
                            className={`${chipClass} ${isOpen && chipOpenClass}`}
                        >
                            <span>{label}</span>
                        </button>
                    )}
                </Select>
                {children}
            </span>
        )
    }

    if (widgetType === 'course') {
        const options = courses.length
            ? courses.map((course) => ({ uid: String(course.courseId), label: course.title, icon: null, course }))
            : [{ uid: null, label: 'No courses', icon: null }]

        return (
            <span {...attributes} contentEditable={false} className='inline-flex align-baseline'>
                <Select
                    options={options}
                    isOptionSelected={(option) => String(option.uid || '') === String(element.segment?.value?.courseId || '')}
                    onSelect={(option) => {
                        if (!option?.uid) return
                        const course = option.course || courses.find((x) => String(x.courseId) === String(option.uid))
                        const courseTitle = course?.title || option.label || label
                        const resolvedTitle = isTitleMostlyLowercase(label) ? courseTitle.toLowerCase() : courseTitle

                        updateWidgetSegment({
                            ...element.segment,
                            rawText: resolvedTitle,
                            displayText: resolvedTitle,
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
                            onMouseDown={preventEditorBlur}
                            className={`${chipClass} ${isOpen && chipOpenClass}`}
                        >
                            <span>{label}</span>
                        </button>
                    )}
                </Select>
                {children}
            </span>
        )
    }

    // fallback for unrecognized widget
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