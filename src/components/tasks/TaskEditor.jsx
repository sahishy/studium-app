import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createEditor, Editor, Element as SlateElement, Node, Transforms } from 'slate'
import { Editable, ReactEditor, Slate, withReact } from 'slate-react'
import { withHistory } from 'slate-history'
import BottomPadding from '../main/BottomPadding.jsx'
import ListTask from './ListTask.jsx'
import { useTasks } from '../../contexts/TasksContext.jsx'
import { createTask, deleteTask, updateTask } from '../../services/taskService.jsx'

const makeTaskNode = (taskId, title = '', status = 'Incomplete') => ({
    type: 'task-item',
    taskId,
    status,
    children: [{ text: title }],
})

const makeEmptyValue = () => [makeTaskNode(createLocalTaskId())]

const createLocalTaskId = () => {
    if(typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
    }
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const withTaskBehavior = (editor) => {
    const { insertBreak } = editor

    editor.insertBreak = () => {
        const currentEntry = Editor.above(editor, {
            match: (n) => SlateElement.isElement(n) && n.type === 'task-item',
        })

        if(currentEntry) {
            const [currentNode] = currentEntry
            const currentText = Node.string(currentNode).trim()

            // Don't create another line if the current one is already empty
            if(currentText.length === 0) {
                return
            }
        }

        insertBreak()

        const entry = Editor.above(editor, {
            match: (n) => SlateElement.isElement(n) && n.type === 'task-item',
        })

        if(entry) {
            const [, path] = entry
            Transforms.setNodes(
                editor,
                {
                    taskId: createLocalTaskId(),
                    status: 'Incomplete',
                },
                { at: path }
            )
        }
    }

    return editor
}

const TaskEditor = ({ profile }) => {
    const { user: userTasks, circle: circleTasks } = useTasks()
    const [isFocused, setIsFocused] = useState(false)
    const lastSyncedSignatureRef = useRef('')
    const hasAutoFocusedRef = useRef(false)

    const editor = useMemo(() => withTaskBehavior(withHistory(withReact(createEditor()))), [])

    const sortedTasks = useMemo(() => {
        const tasks = [...userTasks, ...circleTasks]

        return tasks.sort((a, b) => {
            const aListIndex = typeof a?.listIndex === 'number' ? a.listIndex : -1
            const bListIndex = typeof b?.listIndex === 'number' ? b.listIndex : -1

            if(aListIndex !== -1 && bListIndex !== -1) {
                return aListIndex - bListIndex
            }

            if(aListIndex !== -1) return -1
            if(bListIndex !== -1) return 1

            const aCreated = a?.createdAt?.seconds ? a.createdAt.seconds : 0
            const bCreated = b?.createdAt?.seconds ? b.createdAt.seconds : 0
            return aCreated - bCreated
        })
    }, [userTasks, circleTasks])

    const mappedValue = useMemo(() => {
        if(sortedTasks.length === 0) {
            return makeEmptyValue()
        }

        return sortedTasks.map((task) =>
            makeTaskNode(task.uid, task.title ?? '', task.status ?? 'Incomplete')
        )
    }, [sortedTasks])

    const mappedSignature = useMemo(() => JSON.stringify(mappedValue), [mappedValue])

    useEffect(() => {
        if(isFocused) return
        if(lastSyncedSignatureRef.current === mappedSignature) return

        Editor.withoutNormalizing(editor, () => {
            editor.children = mappedValue
            editor.selection = null
        })

        lastSyncedSignatureRef.current = mappedSignature
        editor.onChange()
    }, [editor, isFocused, mappedSignature, mappedValue])

    useEffect(() => {
        if(hasAutoFocusedRef.current) return

        hasAutoFocusedRef.current = true
        requestAnimationFrame(() => {
            ReactEditor.focus(editor)
        })
    }, [editor])

    const renderElement = useCallback((props) => {
        const { attributes, children, element } = props

        if(element.type !== 'task-item') {
            return <p {...attributes}>{children}</p>
        }

        return <ListTask attributes={attributes} children={children} element={element} editor={editor} />
    }, [editor])

    const saveFromEditor = async () => {
        const nextLines = editor.children
            .filter((n) => SlateElement.isElement(n) && n.type === 'task-item')
            .map((n, index) => ({
                taskId: n.taskId || createLocalTaskId(),
                status: n.status === 'Completed' ? 'Completed' : 'Incomplete',
                title: Node.string(n).trim(),
                listIndex: index,
            }))
            .filter((line) => line.title.length > 0)

        const existingById = new Map(sortedTasks.map((task) => [task.uid, task]))
        const seenIds = new Set(nextLines.map((line) => line.taskId))

        const updates = []
        const creates = []

        for(const line of nextLines) {
            const existing = existingById.get(line.taskId)

            if(existing) {
                if(
                    existing.title !== line.title
                    || existing.status !== line.status
                    || existing.listIndex !== line.listIndex
                ) {
                    updates.push(
                        updateTask(
                            existing.uid,
                            { title: line.title, status: line.status, listIndex: line.listIndex },
                            profile.currentTask
                        )
                    )
                }
                continue
            }

            const fallbackTask = sortedTasks[sortedTasks.length - 1] || null

            creates.push(
                createTask({
                    taskId: line.taskId,
                    title: line.title,
                    ownerType: fallbackTask?.ownerType || 'user',
                    ownerId: fallbackTask?.ownerId || profile.uid,
                    createdByUserId: profile.uid,
                    dueAt: fallbackTask?.dueAt ?? -1,
                    status: line.status,
                    listIndex: line.listIndex,
                })
            )
        }

        const deletes = sortedTasks
            .filter((task) => !seenIds.has(task.uid))
            .map((task) => deleteTask(task.uid))

        await Promise.all([...updates, ...creates, ...deletes])

        const latestMapped = sortedTasks.length
            ? sortedTasks.map((task) => makeTaskNode(task.uid, task.title ?? '', task.status ?? 'Incomplete'))
            : makeEmptyValue()
        lastSyncedSignatureRef.current = JSON.stringify(latestMapped)
    }

    return (
        <div className='w-full h-full'>
            <div className='w-full min-h-[60vh] cursor-text'>
                <Slate editor={editor} initialValue={mappedValue} onChange={() => {}}>
                    <Editable
                        renderElement={renderElement}
                        placeholder='Type a task, then press Enter to add it'
                        className='w-full min-h-[60vh] text-sm text-text1 focus:outline-none'
                        onFocus={() => setIsFocused(true)}
                        onBlur={async () => {
                            await saveFromEditor()
                            setIsFocused(false)
                        }}
                    />
                </Slate>
            </div>

            <BottomPadding/>
        </div>
    )
}

export default TaskEditor