import { useCallback, useEffect, useRef, useState } from 'react'
import { FaCheck } from 'react-icons/fa6'
import TextTooltip from '../../../shared/components/tooltips/TextTooltip'
import TaskParsingInput from './TaskParsingInput.jsx'
import { flattenTaskTitle } from '../utils/naturalLanguage'

const ConditionalTooltip = ({ children, label, isBlockedByChildren }) => {
    return (
        <TextTooltip text={label} disabled={!isBlockedByChildren}>
            {children}
        </TextTooltip>
    )
}

const ListTask = ({ task, depth = 0, hasChildren = false, circles = [], courses = [], onUpdate, onDelete }) => {

    const [titleText, setTitleText] = useState(flattenTaskTitle(task.title))
    const taskInputContainerRef = useRef(null)
    const isCompleted = task.status === 'Completed'
    const isEmpty = !titleText.trim()
    const isBlockedByChildren = hasChildren && !isCompleted
    const isDisabled = isEmpty || hasChildren

    const focusTaskInput = useCallback(() => {
        taskInputContainerRef.current?.focusAtEnd?.()
    }, [])

    const shouldSkipRowFocus = useCallback((eventTarget) => {
        if(!(eventTarget instanceof Element)) return false

        return Boolean(
            eventTarget.closest('[contenteditable="true"]') ||
            eventTarget.closest('button')
        )
    }, [])

    useEffect(() => {
        setTitleText(flattenTaskTitle(task.title))
    }, [task.title])

    return (
        <div
            data-task-completed={isCompleted ? 'true' : 'false'}
            className={`group flex items-center gap-2 text-sm px-3 rounded-xl hover:bg-neutral5/40 focus-within:bg-neutral5/40 cursor-text
                ${isCompleted ? 'text-text2' : 'text-text1'} transition-all`}
            style={{ marginLeft: `${depth * 32 + (depth > 0 ? 6 : 0)}px` }}
            onMouseDown={(event) => {
                if(shouldSkipRowFocus(event.target)) return
                event.preventDefault()
                focusTaskInput()
            }}
            onClick={(event) => {
                if(shouldSkipRowFocus(event.target)) return
                focusTaskInput()
            }}
        >
            <span className={isEmpty ? 'cursor-text' : ''}>
                <ConditionalTooltip
                    label={'Complete subtasks first'}
                    isBlockedByChildren={isBlockedByChildren}
                >
                    <button
                        type='button'
                        disabled={isDisabled}
                        onMouseDown={async (e) => {
                            e.preventDefault()
                            if(isDisabled) return

                            const nextStatus = isCompleted ? 'Incomplete' : 'Completed'
                            await onUpdate?.(task.uid, { status: nextStatus })
                        }}
                        className={`group/check shrink-0 flex h-4 w-4 items-center justify-center rounded-md border bg-transparent transition-all ${isEmpty
                            ? 'opacity-0 border-transparent cursor-default pointer-events-none'
                            : hasChildren
                                ? 'opacity-40 border-neutral2 cursor-not-allowed'
                                : isCompleted
                                    ? 'opacity-100 bg-neutral1! border-neutral1 cursor-pointer'
                                    : 'opacity-100 border-neutral2 hover:border-neutral1 cursor-pointer'
                        }`}
                    >
                        <FaCheck
                            className={`text-[10px] text-neutral6 ${isCompleted
                                ? 'opacity-100'
                                : 'opacity-0'
                            }`}
                        />
                    </button>
                </ConditionalTooltip>
            </span>

            <div className={`relative isolate w-full border-b border-neutral4 ${isEmpty ? 'py-0' : 'py-3'}`}>
                {isEmpty && (
                    <span className='pointer-events-none select-none absolute inset-0 -z-10 text-neutral1'>
                        Type a {depth > 0 && 'sub'}task
                    </span>
                )}
                <TaskParsingInput
                    inputRef={taskInputContainerRef}
                    title={task.title}
                    circles={circles}
                    courses={courses}
                    isCompleted={isCompleted}
                    commitOnWidgetChange
                    className={`w-full ${isCompleted ? 'line-through text-neutral1' : 'text-neutral0'}`}
                    placeholder={'No title'}
                    onCommit={(payload) => {
                        setTitleText(payload.plainTitle)

                        onUpdate?.(task.uid, {
                            title: payload.title,
                            type: payload.metadata.taskType || payload.parsedTaskType || task.type || 'assignment',
                        })
                    }}
                    onEmpty={() => onDelete?.(task.uid)}
                />
            </div>
        </div>
    )
}

export default ListTask