import { Element as SlateElement, Text, Transforms, Editor } from 'slate'
import { normalizeTaskTitle } from './naturalLanguage'

const isTitleMostlyLowercase = (rawText = '') => {
    const letters = String(rawText || '').match(/[a-zA-Z]/g) || []
    if(!letters.length) return false

    const lowercaseCount = letters.filter((char) => char >= 'a' && char <= 'z').length
    return lowercaseCount > letters.length / 2
}

const makeWidgetElement = (segment) => ({
    type: 'task-widget',
    segment,
    children: [{ text: '' }],
})

const segmentsToSlateChildren = (title) => {
    const normalized = normalizeTaskTitle(title)
    const children = normalized.segments.flatMap((segment) => {
        if(segment.type === 'widget') return [makeWidgetElement(segment)]
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
    segmentsToSlateChildren,
    slateChildrenToSegments,
    replaceTextNodeWithWidget,
    isTitleMostlyLowercase,
}