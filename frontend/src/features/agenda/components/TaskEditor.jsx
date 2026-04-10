import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createEditor, Editor, Element as SlateElement, Range, Text, Transforms } from 'slate'
import { Editable, ReactEditor, Slate, withReact } from 'slate-react'
import { withHistory } from 'slate-history'
import ListTask from './ListTask.jsx'
import TaskWidgetElement from './TaskWidgetElement.jsx'
import {
    createLocalTaskId,
    dueDateToDueAt,
    hasStartTextNode,
    isValidTaskEditorTree,
    makeEmptyValue,
    makeTaskNode,
    replaceTextNodeWithWidget,
    slateChildrenToSegments,
    isTaskNodeEmpty,
    withTaskBehavior,
} from '../utils/taskEditorUtils'
import { useTasks } from '../contexts/TasksContext'
import { createTask, deleteTask, updateTask } from '../services/taskService'
import { useCourses } from '../../courses/contexts/CoursesContext'
import { useCircles } from '../../circles/contexts/CirclesContext'
import { extractTaskTitleMetadata, flattenTaskTitle, normalizeTaskTitle, parseTaskInput } from '../utils/naturalLanguage'

const TaskEditor = ({ profile }) => {

    const { user: userTasks, circle: circleTasks, isReady: tasksReady } = useTasks()
    const { courses } = useCourses()
    const circles = useCircles()
    const [isFocused, setIsFocused] = useState(false)
    const lastSyncedSignatureRef = useRef('')
    const hasAutoFocusedRef = useRef(false)
    const isDirtyRef = useRef(false)
    const hasHydratedFromServerRef = useRef(false)

    const editor = useMemo(() => withTaskBehavior(withHistory(withReact(createEditor()))), [])

    const sortedTasks = useMemo(() => {
        const tasks = [...userTasks, ...circleTasks]

        return tasks.sort((a, b) => {

            const aListIndex = typeof a?.listIndex === 'number' ? a.listIndex : -1
            const bListIndex = typeof b?.listIndex === 'number' ? b.listIndex : -1

            if(aListIndex !== -1 && bListIndex !== -1) return aListIndex - bListIndex
            if(aListIndex !== -1) return -1
            if(bListIndex !== -1) return 1

            const aCreated = a?.createdAt?.seconds ? a.createdAt.seconds : 0
            const bCreated = b?.createdAt?.seconds ? b.createdAt.seconds : 0

            return aCreated - bCreated

        })
    }, [userTasks, circleTasks])

    const mappedValue = useMemo(() => {
        if(sortedTasks.length === 0) return makeEmptyValue()
        return sortedTasks.map((task) => makeTaskNode(
            task.uid,
            task.title ?? '',
            task.status ?? 'Incomplete',
            task.parentTaskId ?? null,
            task.siblingIndex ?? 0,
        ))
    }, [sortedTasks])

    const mappedSignature = useMemo(() => JSON.stringify(mappedValue), [mappedValue])

    const repairEditorTreeIfNeeded = useCallback((fallbackValue = mappedValue) => {

        const hasValidStructure = isValidTaskEditorTree(editor.children)
        const hasValidStartNode = hasStartTextNode(editor)
        if(hasValidStructure && hasValidStartNode) return false

        const safeValue = Array.isArray(fallbackValue) && fallbackValue.length ? fallbackValue : makeEmptyValue()

        Editor.withoutNormalizing(editor, () => {
            editor.children = safeValue
            editor.selection = null
        })

        editor.onChange()
        return true

    }, [editor, mappedValue])

    useEffect(() => {

        if(!tasksReady) return

        repairEditorTreeIfNeeded(mappedValue)

        const hasValidEditorTree = isValidTaskEditorTree(editor.children)
        const hasValidStartNode = hasStartTextNode(editor)
        const isAlreadySynced = lastSyncedSignatureRef.current === mappedSignature

        if(isFocused && isDirtyRef.current && hasValidEditorTree && hasValidStartNode) return

        if(isAlreadySynced && hasValidEditorTree && hasValidStartNode) {
            hasHydratedFromServerRef.current = true
            return
        }

        Editor.withoutNormalizing(editor, () => {
            editor.children = mappedValue
            editor.selection = null
        })

        lastSyncedSignatureRef.current = mappedSignature
        isDirtyRef.current = false
        hasHydratedFromServerRef.current = true
        editor.onChange()

    }, [editor, isFocused, mappedSignature, mappedValue, repairEditorTreeIfNeeded, tasksReady])

    useEffect(() => {

        if(hasAutoFocusedRef.current) return

        hasAutoFocusedRef.current = true
        requestAnimationFrame(() => {
            repairEditorTreeIfNeeded(mappedValue)

            try {
                const end = Editor.end(editor, [])
                Transforms.select(editor, { anchor: end, focus: end })
                ReactEditor.focus(editor)
            } catch {
                repairEditorTreeIfNeeded(makeEmptyValue())
            }
        })

    }, [editor, mappedValue, repairEditorTreeIfNeeded])

    const buildChildrenByParentId = useCallback(() => {
        const childrenByParentId = new Map()

        editor.children
            .filter((n) => SlateElement.isElement(n) && n.type === 'task-item')
            .forEach((n) => {
                const parentId = n.parentTaskId ?? null
                if(!parentId) return
                if(!childrenByParentId.has(parentId)) childrenByParentId.set(parentId, [])
                childrenByParentId.get(parentId).push(n)
            })

        return childrenByParentId
    }, [editor])

    const syncParentStatuses = useCallback(() => {
        const taskEntries = editor.children
            .map((node, index) => [node, [index]])
            .filter(([node]) => SlateElement.isElement(node) && node.type === 'task-item')

        if(taskEntries.length === 0) return

        const nodeById = new Map()
        const pathById = new Map()
        const childrenByParentId = new Map()
        const statusById = new Map()

        taskEntries.forEach(([taskNode, path]) => {
            nodeById.set(taskNode.taskId, taskNode)
            pathById.set(taskNode.taskId, path)
            statusById.set(taskNode.taskId, taskNode.status)

            const parentId = taskNode.parentTaskId ?? null
            if(!parentId) return
            if(!childrenByParentId.has(parentId)) childrenByParentId.set(parentId, [])
            childrenByParentId.get(parentId).push(taskNode.taskId)
        })

        let changed = true
        let passCount = 0
        const maxPasses = taskEntries.length

        while(changed && passCount < maxPasses) {
            changed = false
            passCount += 1

            for(const [taskId, taskNode] of nodeById.entries()) {
                const childIds = childrenByParentId.get(taskId) || []
                if(childIds.length === 0) continue

                const desiredStatus = childIds.every((childId) => statusById.get(childId) === 'Completed')
                    ? 'Completed'
                    : 'Incomplete'

                if(statusById.get(taskId) !== desiredStatus) {
                    statusById.set(taskId, desiredStatus)
                    changed = true
                }
            }
        }

        const statusUpdates = []

        for(const [taskId, taskNode] of nodeById.entries()) {
            const finalStatus = statusById.get(taskId)
            if(taskNode.status !== finalStatus) {
                statusUpdates.push({ path: pathById.get(taskId), desiredStatus: finalStatus })
            }
        }

        if(statusUpdates.length === 0) return

        Editor.withoutNormalizing(editor, () => {
            statusUpdates.forEach(({ path, desiredStatus }) => {
                Transforms.setNodes(editor, { status: desiredStatus }, { at: path })
            })
        })
    }, [editor])

    const renderElement = useCallback((props) => {

        const { attributes, children, element } = props

        if(element.type === 'task-widget') {
            return (
                <TaskWidgetElement
                    attributes={attributes}
                    children={children}
                    element={element}
                    circles={circles}
                    courses={courses}
                />
            )
        }

        if(element.type !== 'task-item') return <p {...attributes}>{children}</p>

        const taskItems = editor.children.filter((n) => SlateElement.isElement(n) && n.type === 'task-item')
        const byId = new Map(taskItems.map((n) => [n.taskId, n]))
        const childCounts = new Map()

        taskItems.forEach((n) => {
            const parentId = n.parentTaskId ?? null
            if(!parentId) return
            childCounts.set(parentId, (childCounts.get(parentId) || 0) + 1)
        })

        const resolveDepth = (taskNode) => {
            let depth = 0
            let currentParentId = taskNode.parentTaskId ?? null
            const seen = new Set()

            while(currentParentId && !seen.has(currentParentId)) {
                seen.add(currentParentId)
                const parent = byId.get(currentParentId)
                if(!parent) break
                depth += 1
                currentParentId = parent.parentTaskId ?? null
            }

            return depth
        }

        return (
            <ListTask
                attributes={attributes}
                children={children}
                element={element}
                editor={editor}
                depth={resolveDepth(element)}
                hasChildren={(childCounts.get(element.taskId) || 0) > 0}
                isCompleted={element.status === 'Completed'}
            />
        )
    }, [circles, courses, editor])

    const maybeIndentEmptyTaskFromPrevious = useCallback(() => {
        const { selection } = editor
        if(!selection || !Range.isCollapsed(selection)) return false

        const currentEntry = Editor.above(editor, {
            at: selection.anchor,
            match: (n) => SlateElement.isElement(n) && n.type === 'task-item',
        })

        if(!currentEntry) return false

        const [currentNode, currentPath] = currentEntry
        if(!isTaskNodeEmpty(currentNode)) return false

        const currentIndex = currentPath[0]
        if(currentIndex <= 0) return false

        const previousNode = editor.children[currentIndex - 1]
        if(!SlateElement.isElement(previousNode) || previousNode.type !== 'task-item' || !previousNode.taskId) return false

        const parentTaskId = previousNode.taskId
        const siblings = (buildChildrenByParentId().get(parentTaskId) || [])
            .filter((n) => n.taskId !== currentNode.taskId)
        const nextSiblingIndex = siblings.length
            ? Math.max(...siblings.map((n) => n.siblingIndex ?? 0)) + 1
            : 0

        Transforms.setNodes(
            editor,
            { parentTaskId, siblingIndex: nextSiblingIndex },
            { at: currentPath }
        )

        return true
    }, [editor, buildChildrenByParentId, isTaskNodeEmpty])

    const maybeWidgetizeAtPoint = useCallback((point) => {

        if(!point || point.path.length < 2) return false

        const entry = Editor.node(editor, point.path)
        if(!entry) return false

        const [node, path] = entry
        if(!Text.isText(node)) return false

        const text = node.text || ''
        if(!text.trim()) return false

        const parseResult = parseTaskInput(text, { courses, circles })
        if(!parseResult.matches.length) return false

        const caret = point.offset
        const candidate = [...parseResult.matches]
            .sort((a, b) => b.end - a.end)
            .find((match) => match.end === caret || match.end === caret - 1)

        if(!candidate || candidate.kind === 'taskType') return false

        replaceTextNodeWithWidget({ editor, path, text, candidate, caret })
        return true

    }, [circles, courses, editor])

    const maybeWidgetizeAtCursor = useCallback(() => {

        const { selection } = editor
        if(!selection || !Range.isCollapsed(selection)) return

        const didConvert = maybeWidgetizeAtPoint(selection.anchor)
        if(!didConvert) return

        ReactEditor.focus(editor)

    }, [editor, maybeWidgetizeAtPoint])

    const saveFromEditor = async () => {

        if(!tasksReady) return
        if(!hasHydratedFromServerRef.current) return
        if(!hasStartTextNode(editor)) return
        if(!isValidTaskEditorTree(editor.children)) return

        const nextLines = editor.children
            .filter((n) => SlateElement.isElement(n) && n.type === 'task-item')
            .map((n, index) => ({
                taskId: n.taskId || createLocalTaskId(),
                status: n.status === 'Completed' ? 'Completed' : 'Incomplete',
                parentTaskId: n.parentTaskId ?? null,
                siblingIndex: n.siblingIndex ?? 0,
                titleSegments: slateChildrenToSegments(n.children),
                listIndex: index,
            }))
            .map((line) => ({
                ...line,
                title: normalizeTaskTitle({ segments: line.titleSegments }),
                plainTitle: flattenTaskTitle({ segments: line.titleSegments }),
            }))
            .filter((line) => line.plainTitle.length > 0)

        const existingById = new Map(sortedTasks.map((task) => [task.uid, task]))
        const seenIds = new Set(nextLines.map((line) => line.taskId))
        const updates = []
        const creates = []

        for(const line of nextLines) {
            const existing = existingById.get(line.taskId)

            if(existing) {
                if (
                    flattenTaskTitle(existing.title) !== line.plainTitle
                    || existing.status !== line.status
                    || existing.listIndex !== line.listIndex
                    || (existing.parentTaskId ?? null) !== line.parentTaskId
                    || (existing.siblingIndex ?? 0) !== line.siblingIndex
                ) {
                    const titleMetadata = extractTaskTitleMetadata(line.title)
                    const plainTextParse = parseTaskInput(line.plainTitle, { courses, circles })
                    const resolvedTaskType = titleMetadata.taskType || plainTextParse?.parsed?.taskType || 'assignment'
                    updates.push(
                        updateTask(existing.uid, {
                            title: line.title,
                            status: line.status,
                            listIndex: line.listIndex,
                            parentTaskId: line.parentTaskId,
                            siblingIndex: line.siblingIndex,
                            type: resolvedTaskType || existing.type || 'assignment',
                            dueAt: titleMetadata.dueDate ? dueDateToDueAt(titleMetadata.dueDate) : (existing.dueAt ?? -1),
                        })
                    )
                }
                continue
            }

            const fallbackTask = sortedTasks[sortedTasks.length - 1] || null
            const titleMetadata = extractTaskTitleMetadata(line.title)
            const plainTextParse = parseTaskInput(line.plainTitle, { courses, circles })
            const resolvedTaskType = titleMetadata.taskType || plainTextParse?.parsed?.taskType || 'assignment'

            creates.push(
                createTask({
                    taskId: line.taskId,
                    title: line.title,
                    ownerType: fallbackTask?.ownerType || 'user',
                    ownerId: fallbackTask?.ownerId || profile.uid,
                    dueAt: titleMetadata.dueDate ? dueDateToDueAt(titleMetadata.dueDate) : (fallbackTask?.dueAt ?? -1),
                    status: line.status,
                    listIndex: line.listIndex,
                    parentTaskId: line.parentTaskId,
                    siblingIndex: line.siblingIndex,
                    type: resolvedTaskType,
                })
            )
        }

        const deletes = sortedTasks
            .filter((task) => !seenIds.has(task.uid))
            .map((task) => deleteTask(task.uid))

        await Promise.all([...updates, ...creates, ...deletes])

        const latestMapped = sortedTasks.length
            ? sortedTasks.map((task) => makeTaskNode(
                task.uid,
                task.title ?? '',
                task.status ?? 'Incomplete',
                task.parentTaskId ?? null,
                task.siblingIndex ?? 0,
            ))
            : makeEmptyValue()
        lastSyncedSignatureRef.current = JSON.stringify(latestMapped)
        isDirtyRef.current = false

    }

    return (
        <div className='w-full h-full'>
            <div className='w-full min-h-[60vh] cursor-text'>
                <Slate
                    editor={editor}
                    initialValue={mappedValue}
                    onChange={() => {
                        const isAstChange = editor.operations.some((op) => op.type !== 'set_selection')
                        if (isAstChange) {
                            syncParentStatuses()
                            isDirtyRef.current = true
                        }
                    }}
                >
                    <Editable
                        renderElement={renderElement}
                        placeholder=''
                        className='w-full min-h-[60vh] text-sm text-text1 focus:outline-none'
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                // Convert parseable token at cursor before Slate inserts
                                // a new task line, so Enter behaves like a commit delimiter.
                                maybeWidgetizeAtCursor()
                            }

                            if (event.key === 'Tab') {
                                event.preventDefault()
                                if (editor.selection && Range.isCollapsed(editor.selection)) {
                                    const didIndent = maybeIndentEmptyTaskFromPrevious()
                                    if(didIndent) return
                                    maybeWidgetizeAtPoint(editor.selection.anchor)
                                }
                                return
                            }

                            if (event.key === 'Backspace' && editor.selection && Range.isCollapsed(editor.selection)) {
                                const currentEntry = Editor.above(editor, {
                                    at: editor.selection.anchor,
                                    match: (n) => SlateElement.isElement(n) && n.type === 'task-item',
                                })

                                if(currentEntry) {
                                    const [currentNode, currentPath] = currentEntry
                                    const isAtStart = editor.selection.anchor.offset === 0

                                    if(isAtStart && isTaskNodeEmpty(currentNode) && currentNode.parentTaskId) {
                                        event.preventDefault()

                                        const parentNode = editor.children.find((node) => (
                                            SlateElement.isElement(node)
                                            && node.type === 'task-item'
                                            && node.taskId === currentNode.parentTaskId
                                        ))

                                        const nextParentTaskId = (
                                            SlateElement.isElement(parentNode)
                                            && parentNode.type === 'task-item'
                                        )
                                            ? (parentNode.parentTaskId ?? null)
                                            : null

                                        const siblingCandidates = editor.children.filter((node) => (
                                            SlateElement.isElement(node)
                                            && node.type === 'task-item'
                                            && node.taskId !== currentNode.taskId
                                            && (node.parentTaskId ?? null) === nextParentTaskId
                                        ))

                                        const nextSiblingIndex = siblingCandidates.length
                                            ? Math.max(...siblingCandidates.map((node) => node.siblingIndex ?? 0)) + 1
                                            : 0

                                        Transforms.setNodes(
                                            editor,
                                            { parentTaskId: nextParentTaskId, siblingIndex: nextSiblingIndex },
                                            { at: currentPath }
                                        )
                                        return
                                    }
                                }
                            }

                            // Keep natural typing, but auto-convert when the user
                            // finishes a token with common delimiters.
                            if ([' ', ',', '.'].includes(event.key)) {
                                requestAnimationFrame(() => maybeWidgetizeAtCursor())
                            }
                        }}
                        onFocus={() => setIsFocused(true)}
                        onBlur={async () => {
                            maybeWidgetizeAtCursor()
                            if (isDirtyRef.current) await saveFromEditor()
                            setIsFocused(false)
                        }}
                    />
                </Slate>
            </div>

        </div>
    )
}

export default TaskEditor