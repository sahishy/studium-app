import { useCallback, useEffect, useRef, useState } from 'react'
import { FaCheck, FaGripLinesVertical } from 'react-icons/fa6'
import TextTooltip from '../../../shared/components/tooltips/TextTooltip'
import TaskParsingInput from './TaskParsingInput.jsx'
import { flattenTaskTitle } from '../utils/naturalLanguage'

const ListTask = ({ task, depth = 0, hasChildren = false, circles = [], courses = [],
    onRegisterFocusHandle,
    onUpdate,
    onDelete,
    onCreateTaskAfter,
    onTabInTask,
    onTaskBlur,
}) => {
    const [titleText, setTitleText] = useState(flattenTaskTitle(task.title))
    const inputContainerRef = useRef(null)
    const pendingPayloadRef = useRef(null)

    const isCompleted = task.status === 'Completed'
    const isEmpty = !titleText.trim()
    const isCheckDisabled = isEmpty || hasChildren

    const focusInput = useCallback(() => {
        inputContainerRef.current?.focusAtEnd?.()
    }, [])

    const isInteractiveTarget = useCallback((target) => {
        if (!(target instanceof Element)) return false
        return Boolean(target.closest('[contenteditable="true"]') || target.closest('button'))
    }, [])

    useEffect(() => {
        setTitleText(flattenTaskTitle(task.title))
        pendingPayloadRef.current = null
    }, [task.title])

    useEffect(() => {
        onRegisterFocusHandle?.(task.uid, focusInput)
        return () => onRegisterFocusHandle?.(task.uid, null)
    }, [focusInput, onRegisterFocusHandle, task.uid])

    return (
        <div
            data-task-completed={isCompleted ? 'true' : 'false'}
            className='group relative flex items-center gap-2 text-sm px-3 rounded-xl hover:bg-neutral5/40 focus-within:bg-neutral5/40 cursor-text transition-all ease-out'
            style={{ marginLeft: `${depth * 32}px` }}
            onMouseDown={(e) => { if (!isInteractiveTarget(e.target)) { e.preventDefault(); focusInput() } }}
            onClick={(e) => { if (!isInteractiveTarget(e.target)) focusInput() }}
        >
            {depth > 0 && (
                <span className='pointer-events-none absolute inset-y-0 -left-3'>
                    {Array.from({ length: depth }).map((_, i) => (
                        <span
                            key={i}
                            className='absolute top-0 bottom-0 w-px bg-neutral5 rounded-full'
                            style={{ left: `${i * -32}px` }}
                        />
                    ))}
                </span>
            )}

            <TextTooltip
                text='Complete subtasks first'
                disabled={!(hasChildren && !isCompleted)}
                placement='top'
            >
                <button
                    type='button'
                    disabled={isCheckDisabled}
                    onMouseDown={async (e) => {
                        e.preventDefault()
                        if (isCheckDisabled) return
                        await onUpdate?.(task.uid, { status: isCompleted ? 'Incomplete' : 'Completed' })
                    }}
                    className={`group/check shrink-0 flex h-4 w-4 items-center justify-center rounded-md border bg-transparent transition-all
                        ${hasChildren
                            ? 'opacity-40 border-neutral2 cursor-not-allowed'
                            : isCompleted
                                ? 'opacity-100 bg-neutral1! border-neutral1 cursor-pointer'
                                : 'opacity-100 border-neutral2 hover:border-neutral1 cursor-pointer'
                        }`}
                >
                    <FaCheck className={`text-[10px] text-neutral6 ${isCompleted ? 'opacity-100' : 'opacity-0'}`} />
                </button>
            </TextTooltip>

            <div className='relative w-full border-b border-neutral4 py-3'>
                <TaskParsingInput
                    inputRef={inputContainerRef}
                    title={task.title}
                    circles={circles}
                    courses={courses}
                    isCompleted={isCompleted}
                    className={`w-full ${isCompleted ? 'line-through text-neutral1' : 'text-neutral0'}`}
                    placeholder='No title'
                    onCommit={(payload) => {
                        setTitleText(payload.plainTitle)
                        pendingPayloadRef.current = payload
                    }}
                    onEnterKey={() => onCreateTaskAfter?.(task, pendingPayloadRef.current)}
                    onTabKey={() => onTabInTask?.(task.uid)}
                    onBlur={() => {
                        const payload = pendingPayloadRef.current
                        if (payload) {
                            onUpdate?.(task.uid, {
                                title: payload.title,
                                type: payload.metadata.taskType || 'assignment',
                            })
                            pendingPayloadRef.current = null
                        }
                        onTaskBlur?.(task.uid)
                    }}
                    onEmpty={(meta) => onDelete?.(task.uid, meta)}
                />
            </div>

            <div className='absolute -left-6 px-1.5 py-3 group-hover:opacity-100 opacity-0 transition cursor-grab'>
                <FaGripLinesVertical className='text-neutral2'/>
            </div>

        </div>
    )
}

export default ListTask