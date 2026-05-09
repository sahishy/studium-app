import { useCallback } from 'react'
import { ReactEditor, useSlateStatic } from 'slate-react'
import { Transforms } from 'slate'
import DatePicker from '../../../shared/components/popovers/DatePicker'
import Select from '../../../shared/components/popovers/Select'
import { resolveTaskDateWidgetLabel } from '../utils/taskDateDisplayUtils'
import { isTitleMostlyLowercase } from '../utils/taskParsingSlateUtils'
import { buildCircleOptions, buildCircleWidgetSegment, buildCourseOptions, buildCourseWidgetSegment, buildDateWidgetSegment, getDateControlState } from '../utils/taskWidgetControlUtils'

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
        const { selectedDate } = getDateControlState({ segments: [element.segment] })

        return (
            <span {...attributes} contentEditable={false} className='inline-flex align-baseline'>
                <DatePicker
                    selectedDate={selectedDate}
                    onSelect={(date) => {
                        if (date === -1) {
                            updateWidgetSegment({
                                ...element.segment,
                                rawText: '',
                                displayText: '',
                                value: { ...(element.segment?.value || {}), dueDate: '' },
                            })
                            return
                        }

                        const nextSegment = buildDateWidgetSegment({
                            currentSegment: element.segment,
                            date,
                            toLabel: (nextLabel) => (isTitleMostlyLowercase(label) ? nextLabel.toLowerCase() : nextLabel),
                        })

                        updateWidgetSegment(nextSegment)
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
        const options = buildCircleOptions(circles)

        return (
            <span {...attributes} contentEditable={false} className='inline-flex align-baseline'>
                <Select
                    options={options}
                    isOptionSelected={(option) => {
                        const currentCircleId = element.segment?.value?.circleId || ''
                        return option.uid === null ? !currentCircleId : String(option.uid) === String(currentCircleId)
                    }}
                    onSelect={(option) => {
                        if (!option?.uid) {
                            updateWidgetSegment({
                                ...element.segment,
                                rawText: '',
                                displayText: '',
                                value: { ...(element.segment?.value || {}), circleId: '', title: '' },
                            })
                            return
                        }

                        const chosenTitle = circles.find((x) => x.uid === option.uid)?.title || option.label || label
                        updateWidgetSegment(buildCircleWidgetSegment({
                            currentSegment: element.segment,
                            circleId: option.uid,
                            circles,
                            fallbackLabel: chosenTitle,
                        }))
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
        const options = buildCourseOptions(courses)

        return (
            <span {...attributes} contentEditable={false} className='inline-flex align-baseline'>
                <Select
                    options={options}
                    isOptionSelected={(option) => String(option.uid || '') === String(element.segment?.value?.courseId || '')}
                    onSelect={(option) => {
                        if (!option?.uid) {
                            updateWidgetSegment({
                                ...element.segment,
                                rawText: '',
                                displayText: '',
                                value: { ...(element.segment?.value || {}), courseId: '', title: '', subject: '' },
                            })
                            return
                        }

                        const course = option.course || courses.find((x) => String(x.courseId) === String(option.uid))
                        const courseTitle = course?.title || option.label || label
                        updateWidgetSegment(buildCourseWidgetSegment({
                            currentSegment: element.segment,
                            courseId: String(option.uid),
                            courses,
                            fallbackLabel: courseTitle,
                            toLabel: (nextLabel) => (isTitleMostlyLowercase(label) ? nextLabel.toLowerCase() : nextLabel),
                        }))
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