import { useCallback, useEffect, useMemo, useRef } from 'react'
import { createEditor, Editor, Element as SlateElement, Range, Text, Transforms } from 'slate'
import { Editable, ReactEditor, Slate, withReact } from 'slate-react'
import TaskWidgetElement from './TaskWidgetElement.jsx'
import { replaceTextNodeWithWidget, segmentsToSlateChildren, slateChildrenToSegments } from '../utils/taskParsingSlateUtils'
import { extractTaskTitleMetadata, flattenTaskTitle, normalizeTaskTitle, parseTaskInput } from '../utils/naturalLanguage'

const makeLineValue = (title = '') => ([{
    type: 'task-line',
    children: segmentsToSlateChildren(title),
}])

const hideTrailingCircleWidgetSpacer = (title = '') => {
    const normalized = normalizeTaskTitle(title)
    const segments = Array.isArray(normalized?.segments) ? [...normalized.segments] : []
    if (segments.length < 2) return normalized

    const last = segments[segments.length - 1]
    const prev = segments[segments.length - 2]
    const isTrailingCircleWidget = last?.type === 'widget' && last?.widgetType === 'circle'
    if (!isTrailingCircleWidget || prev?.type !== 'text') return normalized

    const prevRaw = typeof prev.rawText === 'string' ? prev.rawText : ''
    if (!prevRaw.endsWith(' ')) return normalized

    const trimmedRaw = prevRaw.replace(/\s+$/, '')
    const prevDisplay = typeof prev.displayText === 'string' ? prev.displayText : prevRaw
    const trimmedDisplay = prevDisplay.replace(/\s+$/, '')

    segments[segments.length - 2] = {
        ...prev,
        rawText: trimmedRaw,
        displayText: trimmedDisplay,
    }

    return { ...normalized, segments }
}

const withSingleLineTaskInput = (editor) => {
    const { isInline, isVoid, normalizeNode } = editor

    editor.isInline = (element) => element.type === 'task-widget' || isInline(element)
    editor.isVoid = (element) => element.type === 'task-widget' || isVoid(element)

    editor.normalizeNode = (entry) => {
        const [node, path] = entry

        if (path.length === 0) {
            if (editor.children.length === 0) {
                Transforms.insertNodes(editor, makeLineValue('')[0], { at: [0] })
                return
            }
            if (editor.children.length > 1) {
                Transforms.removeNodes(editor, { at: [1] })
                return
            }
            const first = editor.children[0]
            if (!SlateElement.isElement(first) || first.type !== 'task-line') {
                editor.children = makeLineValue(first?.children || '')
                return
            }
        }

        if (SlateElement.isElement(node) && node.type === 'task-line') {
            if (!Array.isArray(node.children) || node.children.length === 0) {
                Transforms.insertNodes(editor, { text: '' }, { at: [...path, 0] })
                return
            }
            const lastChild = node.children[node.children.length - 1]
            if (SlateElement.isElement(lastChild) && lastChild.type === 'task-widget') {
                Transforms.insertNodes(editor, { text: '' }, { at: [...path, node.children.length] })
                return
            }
        }

        normalizeNode(entry)
    }

    return editor
}

const TaskParsingInput = ({
    title = '',
    onCommit,
    onBeforeCommit,
    onEmpty,
    courses = [],
    circles = [],
    isCompleted = false,
    placeholder = 'Type a task',
    className = '',
    clearOnEnter = false,
    keepFocusOnEnter = false,
    commitOnBlur = true,
    commitOnWidgetChange = false,
    allowEmptyCommit = false,
    onEnterKey,
    onTabKey,
    onBlur,
    inputRef,
    invertedWidgets,
    hideCircleWidgets = false,
}) => {
    const editor = useMemo(() => withSingleLineTaskInput(withReact(createEditor())), [])
    const lastSignatureRef = useRef(null)

    const setContainerRef = useCallback((node) => {
        if (node) {
            node.focusAtEnd = () => {
                const end = Editor.end(editor, [0])
                Transforms.select(editor, { anchor: end, focus: end })
                ReactEditor.focus(editor)
            }
        }
        if (typeof inputRef === 'function') inputRef(node)
        else if (inputRef) inputRef.current = node
    }, [editor, inputRef])

    const normalizeEditorFromTitle = useCallback((nextTitle) => {
        const displayTitle = hideCircleWidgets ? hideTrailingCircleWidgetSpacer(nextTitle) : nextTitle
        const nextValue = makeLineValue(displayTitle)
        const nextSignature = JSON.stringify(nextValue)
        if (lastSignatureRef.current === nextSignature) return

        Editor.withoutNormalizing(editor, () => {
            editor.children = nextValue
            editor.selection = null
        })
        lastSignatureRef.current = nextSignature
        editor.onChange()
    }, [editor, hideCircleWidgets])

    useEffect(() => {
        normalizeEditorFromTitle(title)
    }, [normalizeEditorFromTitle, title])

    const buildPayloadFromEditor = useCallback(() => {
        const lineNode = editor.children?.[0]
        const segments = SlateElement.isElement(lineNode)
            ? slateChildrenToSegments(lineNode.children)
            : normalizeTaskTitle('').segments

        const normalizedTitle = normalizeTaskTitle({ segments })
        const plainTitle = flattenTaskTitle(normalizedTitle)
        const metadata = extractTaskTitleMetadata(normalizedTitle)

        return {
            title: normalizedTitle,
            plainTitle,
            metadata,
            parsedTaskType: metadata.taskType || 'assignment',
        }
    }, [editor])

    const isEmpty = useCallback(() => {
        const lineNode = editor.children?.[0]
        if (!SlateElement.isElement(lineNode) || !Array.isArray(lineNode.children)) return true

        return !lineNode.children.some((child) => {
            if (Text.isText(child)) return Boolean(child.text?.trim())
            return SlateElement.isElement(child) && child.type === 'task-widget'
        })
    }, [editor])

    const maybeWidgetizeAtPoint = useCallback((point) => {
        if (!point || point.path.length < 2) return false

        const entry = Editor.node(editor, point.path)
        if (!entry) return false

        const [node, path] = entry
        if (!Text.isText(node) || !node.text.trim()) return false

        const parseResult = parseTaskInput(node.text, { courses, circles })
        if (!parseResult.matches.length) return false

        const caret = point.offset
        const candidate = [...parseResult.matches]
            .sort((a, b) => b.end - a.end)
            .find((match) => match.end === caret || match.end === caret - 1)

        if (!candidate || candidate.kind === 'taskType') return false

        replaceTextNodeWithWidget({ editor, path, text: node.text, candidate, caret })
        return true
    }, [circles, courses, editor])

    const maybeWidgetizeAtCursor = useCallback(() => {
        const { selection } = editor
        if (!selection || !Range.isCollapsed(selection)) return false

        const didConvert = maybeWidgetizeAtPoint(selection.anchor)
        if (didConvert) ReactEditor.focus(editor)
        return didConvert
    }, [editor, maybeWidgetizeAtPoint])

    const resetToEmpty = useCallback(() => {
        Editor.withoutNormalizing(editor, () => {
            editor.children = makeLineValue('')
            editor.selection = null
        })
        lastSignatureRef.current = JSON.stringify(makeLineValue(''))
        editor.onChange()
    }, [editor])

    const commitFromEditor = useCallback((reason) => {
        const payload = buildPayloadFromEditor()
        const nextPayload = onBeforeCommit?.(payload, { reason }) || payload

        if (!nextPayload.plainTitle) {
            if (allowEmptyCommit) {
                onCommit?.(nextPayload, { reason })
                return nextPayload
            }
            return null
        }

        onCommit?.(nextPayload, { reason })
        return nextPayload
    }, [allowEmptyCommit, buildPayloadFromEditor, onBeforeCommit, onCommit])

    const renderElement = useCallback((props) => {
        if (props.element.type === 'task-widget') {
            return (
                <TaskWidgetElement
                    {...props}
                    circles={circles}
                    courses={courses}
                    isCompleted={isCompleted}
                    onWidgetCommit={commitOnWidgetChange ? () => commitFromEditor('widget') : undefined}
                    inverted={invertedWidgets}
                    hideCircleWidgets={hideCircleWidgets}
                />
            )
        }
        return <span {...props.attributes} style={{ display: 'block', lineHeight: '1.25rem' }}>{props.children}</span>
    }, [circles, commitFromEditor, commitOnWidgetChange, courses, hideCircleWidgets, isCompleted, invertedWidgets])

    return (
        <div ref={setContainerRef} className={className}>
            <Slate editor={editor} initialValue={makeLineValue(title)}>
                <Editable
                    renderElement={renderElement}
                    placeholder={placeholder}
                    className='w-full text-sm focus:outline-none'
                    onKeyDown={(event) => {
                        if (event.key === 'Backspace') {
                            if (isEmpty()) {
                                event.preventDefault()
                                onEmpty?.({ reason: 'backspace' })
                                return
                            }
                        }

                        if (event.key === 'Tab') {
                            event.preventDefault()
                            onTabKey?.()
                            return
                        }

                        if (event.key === 'Enter') {
                            event.preventDefault()
                            maybeWidgetizeAtCursor()
                            const committed = commitFromEditor('enter')
                            if (!committed) return
                            onEnterKey?.(committed)
                            if (clearOnEnter) resetToEmpty()

                            // refocus after reset
                            // rAF ensures the editor finished
                            // rerendering from the reset before we try to focus it

                            if (keepFocusOnEnter) requestAnimationFrame(() => {
                                ReactEditor.focus(editor)
                                const end = Editor.end(editor, [0])
                                Transforms.select(editor, { anchor: end, focus: end })
                            })
                            return
                        }

                        if ([' ', ',', '.'].includes(event.key)) {
                            requestAnimationFrame(() => maybeWidgetizeAtCursor())
                        }
                    }}
                    onBlur={() => {
                        if (!commitOnBlur) return
                        maybeWidgetizeAtCursor()
                        commitFromEditor('blur')
                        onBlur?.()
                    }}
                />
            </Slate>
        </div>
    )
}

export default TaskParsingInput