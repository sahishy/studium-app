import { Editor, Element as SlateElement, Node, Text, Transforms } from 'slate'
import { normalizeTaskTitle } from './naturalLanguage'

const dueDateToDueAt = (dueDate) => {
    if(!dueDate) return -1
    const parsed = new Date(`${dueDate}T00:00:00`)
    if(Number.isNaN(parsed.getTime())) return -1
    return { seconds: Math.floor(parsed.getTime() / 1000) }
}

const makeWidgetElement = (segment) => ({
    type: 'task-widget',
    segment,
    children: [{ text: '' }],
})

const segmentsToSlateChildren = (title) => {
    const normalized = normalizeTaskTitle(title)
    const children = normalized.segments.flatMap((segment) => {
        if(segment.type === 'widget') {
            return [makeWidgetElement(segment)]
        }

        return [{ text: segment.displayText ?? segment.rawText ?? '' }]
    })

    if(children.length > 0) {
        const lastChild = children[children.length - 1]
        if(SlateElement.isElement(lastChild) && lastChild.type === 'task-widget') {
            children.push({ text: '' })
        }
    }

    return children.length ? children : [{ text: '' }]
}

const slateChildrenToSegments = (children = []) => {
    const segments = []
    let textBuffer = ''

    const flushText = () => {
        if(!textBuffer) return
        segments.push({
            type: 'text',
            rawText: textBuffer,
            displayText: textBuffer,
        })
        textBuffer = ''
    }

    for(const child of children) {
        if(Text.isText(child)) {
            textBuffer += child.text || ''
            continue
        }

        if(SlateElement.isElement(child) && child.type === 'task-widget') {
            flushText()
            if(child.segment) segments.push(child.segment)
        }
    }

    flushText()
    return normalizeTaskTitle({ segments }).segments
}

const createLocalTaskId = () => {
    if(typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const makeTaskNode = (taskId, title = '', status = 'Incomplete', parentTaskId = null, siblingIndex = 0) => ({
    type: 'task-item',
    taskId,
    status,
    parentTaskId,
    siblingIndex,
    children: segmentsToSlateChildren(title),
})

const makeEmptyValue = () => [makeTaskNode(createLocalTaskId())]

const isValidTaskEditorTree = (children) => {
    if(!Array.isArray(children)) return false

    return children.every((node) => (
        SlateElement.isElement(node)
        && node.type === 'task-item'
        && Array.isArray(node.children)
    ))
}

const hasStartTextNode = (editor) => {
    try {
        Editor.start(editor, [])
        return true
    } catch {
        return false
    }
}

const hasTaskContent = (node) => {
    if(!SlateElement.isElement(node)) return false

    for(const [descendant] of Node.descendants(node)) {
        if(Text.isText(descendant) && descendant.text.trim().length > 0) return true
        if(SlateElement.isElement(descendant) && descendant.type === 'task-widget') return true
    }

    return false
}

const isTaskNodeEmpty = (node) => !hasTaskContent(node)

const withTaskBehavior = (editor) => {

    const { insertBreak, isInline, isVoid, normalizeNode } = editor

    editor.isInline = (element) => (element.type === 'task-widget' ? true : isInline(element))
    editor.isVoid = (element) => (element.type === 'task-widget' ? true : isVoid(element))

    editor.insertBreak = () => {

        const currentEntry = Editor.above(editor, {
            match: (n) => SlateElement.isElement(n) && n.type === 'task-item',
        })

        const currentParentTaskId = currentEntry?.[0]?.parentTaskId ?? null
        const currentSiblingIndex = currentEntry?.[0]?.siblingIndex ?? 0

        if(currentEntry) {
            const [currentNode] = currentEntry
            if(!hasTaskContent(currentNode)) return
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
                    parentTaskId: currentParentTaskId,
                    siblingIndex: currentSiblingIndex + 1,
                },
                { at: path }
            )
        }

    }

    editor.normalizeNode = (entry) => {
        const [node, path] = entry

        if(path.length === 0 && editor.children.length === 0) {
            Transforms.insertNodes(editor, makeTaskNode(createLocalTaskId()), { at: [0] })
            return
        }

        if(SlateElement.isElement(node) && node.type === 'task-item') {
            if(!Array.isArray(node.children) || node.children.length === 0) {
                Transforms.insertNodes(editor, { text: '' }, { at: [...path, 0] })
                return
            }

            const lastChildIndex = node.children.length - 1
            const lastChild = node.children[lastChildIndex]
            if(SlateElement.isElement(lastChild) && lastChild.type === 'task-widget') {
                Transforms.insertNodes(editor, { text: '' }, { at: [...path, lastChildIndex + 1] })
                return
            }
        }

        normalizeNode(entry)
    }

    return editor

}

const replaceTextNodeWithWidget = ({ editor, path, text, candidate, caret }) => {

    const before = text.slice(0, candidate.start)
    const after = text.slice(candidate.end)
    const caretOffsetWithinAfter = Math.max(0, Math.min(after.length, caret - candidate.end))

    const parentPath = path.slice(0, -1)
    const leafIndex = path[path.length - 1]
    const insertionPath = [...parentPath, leafIndex]

    const widget = {
        type: 'task-widget',
        segment: {
            id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'widget',
            widgetType:
                candidate.kind === 'date'
                    ? 'date'
                    : candidate.kind === 'course'
                        ? 'course'
                        : candidate.kind === 'circle'
                            ? 'circle'
                            : candidate.kind === 'taskType'
                                ? 'taskType'
                                : 'token',
            rawText: candidate.rawText,
            displayText: candidate.rawText,
            value:
                candidate.kind === 'date'
                    ? { dueDate: candidate?.data?.date || '' }
                    : candidate.kind === 'course'
                        ? {
                            courseId: candidate?.data?.courseId || '',
                            title: candidate?.data?.title || '',
                            subject: candidate?.data?.subject || '',
                        }
                        : candidate.kind === 'circle'
                            ? {
                                circleId: candidate?.data?.circleId || '',
                                title: candidate?.data?.title || '',
                            }
                            : candidate.kind === 'taskType'
                                ? { taskType: candidate?.data?.taskType || 'assignment' }
                                : {},
        },
        children: [{ text: '' }],

    }

    Editor.withoutNormalizing(editor, () => {
        
        Transforms.removeNodes(editor, { at: path })

        const replacementNodes = []
        if(before) replacementNodes.push({ text: before })
        replacementNodes.push(widget)
        replacementNodes.push({ text: after })

        Transforms.insertNodes(editor, replacementNodes, { at: insertionPath })

        const afterIndex = leafIndex + (before ? 2 : 1)
        const nextSelection = {
            anchor: { path: [...parentPath, afterIndex], offset: caretOffsetWithinAfter },
            focus: { path: [...parentPath, afterIndex], offset: caretOffsetWithinAfter },
        }

        Transforms.select(editor, nextSelection)

    })

}

export {
    dueDateToDueAt,
    makeWidgetElement,
    segmentsToSlateChildren,
    slateChildrenToSegments,
    createLocalTaskId,
    makeTaskNode,
    makeEmptyValue,
    isValidTaskEditorTree,
    hasStartTextNode,
    hasTaskContent,
    isTaskNodeEmpty,
    withTaskBehavior,
    replaceTextNodeWithWidget
}