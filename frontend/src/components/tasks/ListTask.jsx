import { createContext } from 'react'
import { Editor, Element as SlateElement, Transforms } from 'slate'
import { FaCheck } from 'react-icons/fa6'
import TextTooltip from '../tooltips/TextTooltip'
import { isTaskNodeEmpty } from '../../utils/taskEditorUtils'

export const TaskRowCompletionContext = createContext(false)

const ConditionalTooltip = ({ children, label, isBlockedByChildren }) => {
    return (
        <TextTooltip text={label} disabled={!isBlockedByChildren}>
            {children}
        </TextTooltip>
    )
}

const ListTask = ({ attributes, children, element, editor, depth = 0, hasChildren = false, isCompleted = false }) => {
    
    const isEmpty = isTaskNodeEmpty(element)
    const isBlockedByChildren = hasChildren && !isCompleted
    const isDisabled = isEmpty || hasChildren

    return (
        <TaskRowCompletionContext.Provider value={isCompleted}>
            <div
                {...attributes}
                data-task-completed={isCompleted ? 'true' : 'false'}
                className={`group my-1 flex cursor-text items-center gap-2 text-sm ${isCompleted ? 'text-text2' : 'text-text1'}`}
                style={{ marginLeft: `${depth * 32 + (depth > 0 ? 6 : 0)}px` }}
            >
                <span
                    contentEditable={false}
                    suppressContentEditableWarning
                    className={isEmpty ? 'cursor-text' : ''}
                >
                    <ConditionalTooltip
                        label={'Complete subtasks first'}
                        isBlockedByChildren={isBlockedByChildren}
                    >
                        <button
                            type='button'
                            disabled={isDisabled}
                            onMouseDown={(e) => {
                                e.preventDefault()
                                const entry = Editor.nodes(editor, {
                                    at: [],
                                    match: (n) => SlateElement.isElement(n) && n.taskId === element.taskId,
                                }).next().value

                                if (!entry) return

                                const [, path] = entry
                                Transforms.setNodes(
                                    editor,
                                    { status: isCompleted ? 'Incomplete' : 'Completed' },
                                    { at: path }
                                )
                            }}
                            className={`group/check shrink-0 flex h-4 w-4 items-center justify-center rounded-[3px] border bg-transparent transition-all ${isEmpty
                                    ? 'opacity-0 border-transparent cursor-default pointer-events-none'
                                    : hasChildren
                                        ? 'opacity-40 border-neutral2 cursor-not-allowed'
                                    : isCompleted
                                        ? 'opacity-100 border-neutral2 cursor-pointer'
                                        : 'opacity-100 border-neutral2 hover:border-neutral1 cursor-pointer'
                                }`}
                        >
                            <FaCheck
                                className={`text-[10px] ${isCompleted
                                        ? 'opacity-100 text-neutral0'
                                        : 'opacity-0 text-neutral2'
                                    }`}
                            />
                        </button>
                    </ConditionalTooltip>
                </span>

                <div className={`relative isolate w-full ${isCompleted ? 'line-through text-neutral1' : 'text-neutral0'}`}>
                    {isEmpty && (
                        <span
                            contentEditable={false}
                            className='pointer-events-none select-none absolute inset-0 -z-10 text-neutral1'
                        >
                            Type a {depth > 0 && 'sub'}task
                        </span>
                    )}
                    {children}
                </div>
            </div>
        </TaskRowCompletionContext.Provider>
    )
}

export default ListTask