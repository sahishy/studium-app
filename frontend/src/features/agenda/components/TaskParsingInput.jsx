import { useCallback, useEffect, useMemo, useRef } from 'react'
import { createEditor, Editor, Element as SlateElement, Range, Text, Transforms } from 'slate'
import { Editable, ReactEditor, Slate, withReact } from 'slate-react'
import TaskWidgetElement from './TaskWidgetElement.jsx'
import { replaceTextNodeWithWidget, segmentsToSlateChildren, slateChildrenToSegments } from '../utils/taskParsingSlateUtils'
import { extractTaskTitleMetadata, flattenTaskTitle, normalizeTaskTitle, parseTaskInput } from '../utils/naturalLanguage'

const makeLineValue = (title = '') => ([
    {
        type: 'task-line',
        children: segmentsToSlateChildren(title),
    },
])

const withSingleLineTaskInput = (editor) => {

    const { isInline, isVoid, normalizeNode } = editor

    editor.isInline = (element) => (element.type === 'task-widget' ? true : isInline(element))
    editor.isVoid = (element) => (element.type === 'task-widget' ? true : isVoid(element))

    editor.normalizeNode = (entry) => {
        const [node, path] = entry

        if(path.length === 0) {
            if(editor.children.length === 0) {
                Transforms.insertNodes(editor, makeLineValue('')[0], { at: [0] })
                return
            }

            if(editor.children.length > 1) {
                Transforms.removeNodes(editor, { at: [1] })
                return
            }

            const first = editor.children[0]
            if(!SlateElement.isElement(first) || first.type !== 'task-line') {
                editor.children = makeLineValue(first?.children || '')
                return
            }
        }

        if(SlateElement.isElement(node) && node.type === 'task-line') {
            if(!Array.isArray(node.children) || node.children.length === 0) {
                Transforms.insertNodes(editor, { text: '' }, { at: [...path, 0] })
                return
            }

            const lastIndex = node.children.length - 1
            const lastChild = node.children[lastIndex]
            if(SlateElement.isElement(lastChild) && lastChild.type === 'task-widget') {
                Transforms.insertNodes(editor, { text: '' }, { at: [...path, lastIndex + 1] })
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
    inputRef,
    invertedWidgets
}) => {

    const editor = useMemo(() => withSingleLineTaskInput(withReact(createEditor())), [])
    const lastExternalSignatureRef = useRef('')

    const setContainerRef = useCallback((node) => {
        if(node) node.focusAtEnd = () => {
            const endPoint = Editor.end(editor, [0])
            Transforms.select(editor, { anchor: endPoint, focus: endPoint })
            ReactEditor.focus(editor)
        }

        if(typeof inputRef === 'function') {
            inputRef(node)
            return
        }

        if(inputRef) inputRef.current = node
    }, [editor, inputRef])

    const normalizeEditorFromTitle = useCallback((nextTitle) => {
        const nextValue = makeLineValue(nextTitle)
        const nextSignature = JSON.stringify(nextValue)
        if(lastExternalSignatureRef.current === nextSignature) return

        Editor.withoutNormalizing(editor, () => {
            editor.children = nextValue
            editor.selection = null
        })
        lastExternalSignatureRef.current = nextSignature
        editor.onChange()
    }, [editor])

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
        const parsedTaskType = parseTaskInput(plainTitle, { courses, circles })?.parsed?.taskType || 'assignment'

        return {
            title: normalizedTitle,
            plainTitle,
            metadata,
            parsedTaskType,
        }
    }, [circles, courses, editor])

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
        if(!selection || !Range.isCollapsed(selection)) return false

        const didConvert = maybeWidgetizeAtPoint(selection.anchor)
        if(didConvert) ReactEditor.focus(editor)
        return didConvert

    }, [editor, maybeWidgetizeAtPoint])

    const resetToEmpty = useCallback(() => {
        Editor.withoutNormalizing(editor, () => {
            editor.children = makeLineValue('')
            editor.selection = null
        })
        lastExternalSignatureRef.current = JSON.stringify(makeLineValue(''))
        editor.onChange()
    }, [editor])

    const commitFromEditor = useCallback((reason) => {
        const payload = buildPayloadFromEditor()

        if(!payload.plainTitle) {
            if(allowEmptyCommit) {
                onCommit?.(payload, { reason })
                return true
            }

            return false
        }

        onCommit?.(payload, { reason })
        return true
    }, [allowEmptyCommit, buildPayloadFromEditor, onCommit])

    const renderElement = useCallback((props) => {
        const { element } = props

        if(element.type === 'task-widget') {
            return (
                <TaskWidgetElement
                    {...props}
                    circles={circles}
                    courses={courses}
                    isCompleted={isCompleted}
                    onWidgetCommit={commitOnWidgetChange ? () => commitFromEditor('widget') : undefined}
                    inverted={invertedWidgets}
                />
            )
        }

        return <span {...props.attributes} style={{ display: 'block', lineHeight: '1.25rem' }}>{props.children}</span>
    }, [circles, commitFromEditor, commitOnWidgetChange, courses, isCompleted])

    return (
        <div ref={setContainerRef} className={className}>
            <Slate
                editor={editor}
                initialValue={makeLineValue(title)}
            >
                <Editable
                    renderElement={renderElement}
                    placeholder={placeholder}
                    className='w-full text-sm focus:outline-none'
                    onKeyDown={(event) => {
                        if(event.key === 'Backspace') {
                            const payload = buildPayloadFromEditor()
                            if(!payload.plainTitle.trim()) {
                                event.preventDefault()
                                onEmpty?.({ reason: 'backspace' })
                                return
                            }
                        }

                        if(event.key === 'Enter') {
                            event.preventDefault()
                            maybeWidgetizeAtCursor()
                            const didCommit = commitFromEditor('enter')
                            if(!didCommit) return

                            if(clearOnEnter) resetToEmpty()
                            if(keepFocusOnEnter) requestAnimationFrame(() => ReactEditor.focus(editor))
                            return
                        }

                        if([' ', ',', '.'].includes(event.key)) {
                            requestAnimationFrame(() => maybeWidgetizeAtCursor())
                        }
                    }}
                    onBlur={() => {
                        if(!commitOnBlur) return
                        maybeWidgetizeAtCursor()
                        commitFromEditor('blur')
                    }}
                />
            </Slate>
        </div>
    )
}

export default TaskParsingInput