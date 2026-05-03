import { Editor, Node } from 'slate'
import { ReactEditor } from 'slate-react'
import { formatRelativeTaskDate, getCalendarDayDifference, isRelativeDatePast } from '../../../shared/utils/formatters'
import { isMajorityLowercase } from './taskParsingSlateUtils'

const readDateContextPrefix = (editor, element) => {

    try {
        const path = ReactEditor.findPath(editor, element)
        const parentPath = path.slice(0, -1)
        const index = path[path.length - 1]
        const parentNode = Node.get(editor, parentPath)
        const siblings = parentNode?.children || []

        const contextText = []
        for (let i = Math.max(0, index - 3); i < index; i++) {
            const sibling = siblings[i]
            if (!sibling) continue

            if (Editor.isBlock(editor, sibling) || sibling.type === 'task-widget') {
                const widgetType = sibling?.segment?.widgetType
                if (widgetType === 'date' || widgetType === 'course' || widgetType === 'circle') continue
                contextText.push(String(sibling?.segment?.rawText || sibling?.segment?.displayText || ''))
                continue
            }

            const leafText = Node.string(sibling)
            if (leafText) contextText.push(leafText)
        }

        return contextText.join('').toLowerCase()
    } catch {
        return ''
    }

}

const readNonWidgetTextAroundDate = (editor, element) => {

    try {

        const path = ReactEditor.findPath(editor, element)
        const parentPath = path.slice(0, -1)
        const parentNode = Node.get(editor, parentPath)
        const siblings = parentNode?.children || []

        const chunks = []
        for (const sibling of siblings) {
            if (!sibling) continue

            if (Editor.isBlock(editor, sibling) || sibling.type === 'task-widget') {
                if (sibling.type === 'task-widget') {
                    const widgetType = sibling?.segment?.widgetType
                    if (widgetType === 'date' || widgetType === 'course' || widgetType === 'circle') continue
                    chunks.push(String(sibling?.segment?.rawText || sibling?.segment?.displayText || ''))
                }
                continue
            }

            const leafText = Node.string(sibling)
            if (leafText) chunks.push(leafText)
        }

        return chunks.join(' ')

    } catch {
        return ''
    }

}

const applyTitleLowercaseIntent = (label, editor, element) => {
    if (!label) return label
    const surroundingText = readNonWidgetTextAroundDate(editor, element)
    return isMajorityLowercase(surroundingText) ? label.toLowerCase() : label
}

const formatDueInDaysLabel = (dayDiff) => {
    if (dayDiff <= 0) return 'due today'
    if (dayDiff === 1) return 'due in 1 day'
    return `due in ${dayDiff} days`
}

const resolveTaskDateWidgetLabel = ({ editor, element, rawLabel, dueDate }) => {
    
    if (!dueDate) return rawLabel || ''

    if (isRelativeDatePast(dueDate)) {
        const pastLabel = formatRelativeTaskDate(dueDate, { fallbackLabel: dueDate })
        return applyTitleLowercaseIntent(pastLabel, editor, element)
    }

    const contextPrefix = readDateContextPrefix(editor, element)
    const isCountdownIntent = /\bdue\s+in\s*$/.test(contextPrefix) || /\bin\s*$/.test(contextPrefix)

    if (isCountdownIntent) {
        const dayDiff = getCalendarDayDifference(new Date(), dueDate)
        if (dayDiff != null) {
            return applyTitleLowercaseIntent(formatDueInDaysLabel(dayDiff), editor, element)
        }
    }

    const fallbackLabel = rawLabel || formatRelativeTaskDate(dueDate, { fallbackLabel: dueDate })
    return applyTitleLowercaseIntent(fallbackLabel, editor, element)

}

export {
    resolveTaskDateWidgetLabel,
}
