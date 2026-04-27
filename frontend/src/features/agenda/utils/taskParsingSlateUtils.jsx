import { Element as SlateElement, Text, Transforms, Editor } from 'slate'
import { normalizeTaskTitle } from './naturalLanguage'

// Checks if the user typed the text in lowercase (so we can match their casing
// when replacing it with a formatted label like a date or course name).
const isTitleMostlyLowercase = (rawText = '') => {
    const text = String(rawText || '')
    return text === text.toLowerCase() && /[a-z]/.test(text)
}

const makeWidgetElement = (segment) => ({
    type: 'task-widget',
    segment,
    children: [{ text: '' }],
})

const segmentsToSlateChildren = (title) => {
    const normalized = normalizeTaskTitle(title)
    const children = normalized.segments.flatMap((segment) => {
        if (segment.type === 'widget') return [makeWidgetElement(segment)]
        return [{ text: segment.displayText ?? segment.rawText ?? '' }]
    })

    // Slate requires a trailing text node after a void/inline element
    const last = children[children.length - 1]
    if (last && SlateElement.isElement(last) && last.type === 'task-widget') {
        children.push({ text: '' })
    }

    return children.length ? children : [{ text: '' }]
}

const slateChildrenToSegments = (children = []) => {
    const segments = []
    let textBuffer = ''

    const flushText = () => {
        if (!textBuffer) return
        segments.push({ type: 'text', rawText: textBuffer, displayText: textBuffer })
        textBuffer = ''
    }

    for (const child of children) {
        if (Text.isText(child)) {
            textBuffer += child.text || ''
            continue
        }
        if (SlateElement.isElement(child) && child.type === 'task-widget') {
            flushText()
            if (child.segment) segments.push(child.segment)
        }
    }

    flushText()
    return normalizeTaskTitle({ segments }).segments
}

const buildWidgetSegment = (candidate) => {
    const base = {
        id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'widget',
        rawText: candidate.rawText,
        displayText: candidate.rawText,
    }

    switch (candidate.kind) {
        case 'date':
            return { ...base, widgetType: 'date', value: { dueDate: candidate?.data?.date || '' } }
        case 'course':
            return {
                ...base,
                widgetType: 'course',
                value: {
                    courseId: candidate?.data?.courseId || '',
                    title: candidate?.data?.title || '',
                    subject: candidate?.data?.subject || '',
                },
            }
        case 'circle':
            return {
                ...base,
                widgetType: 'circle',
                value: {
                    circleId: candidate?.data?.circleId || '',
                    title: candidate?.data?.title || '',
                },
            }
        case 'taskType':
            return { ...base, widgetType: 'taskType', value: { taskType: candidate?.data?.taskType || 'assignment' } }
        default:
            return { ...base, widgetType: 'token', value: {} }
    }
}

const replaceTextNodeWithWidget = ({ editor, path, text, candidate, caret }) => {
    const before = text.slice(0, candidate.start)
    const after = text.slice(candidate.end)
    const caretInAfter = Math.max(0, Math.min(after.length, caret - candidate.end))

    const parentPath = path.slice(0, -1)
    const leafIndex = path[path.length - 1]

    const widget = { type: 'task-widget', segment: buildWidgetSegment(candidate), children: [{ text: '' }] }

    const replacementNodes = [
        ...(before ? [{ text: before }] : []),
        widget,
        { text: after },
    ]

    Editor.withoutNormalizing(editor, () => {
        Transforms.removeNodes(editor, { at: path })
        Transforms.insertNodes(editor, replacementNodes, { at: [...parentPath, leafIndex] })

        const afterIndex = leafIndex + (before ? 2 : 1)
        Transforms.select(editor, {
            anchor: { path: [...parentPath, afterIndex], offset: caretInAfter },
            focus: { path: [...parentPath, afterIndex], offset: caretInAfter },
        })
    })
}

export {
    isTitleMostlyLowercase,
    segmentsToSlateChildren,
    slateChildrenToSegments,
    replaceTextNodeWithWidget,
}