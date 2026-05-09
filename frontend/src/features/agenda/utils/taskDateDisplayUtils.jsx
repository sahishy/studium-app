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

const RELATIVE_DAY_WEEK_REGEX = /\b(\d{1,2}|a|an)\s*(d|day|days|w|week|weeks)\b/i

const parseRelativeDayWeekToken = (value = '') => {
    const text = String(value || '')
    const match = text.match(RELATIVE_DAY_WEEK_REGEX)
    if (!match) return null

    const [, quantityTokenRaw, unitTokenRaw] = match
    const quantityToken = String(quantityTokenRaw || '').toLowerCase()
    const unitToken = String(unitTokenRaw || '')
    const unitTokenLower = unitToken.toLowerCase()

    return {
        original: match[0],
        quantityToken,
        unitToken,
        isWeek: unitTokenLower === 'w' || unitTokenLower === 'week' || unitTokenLower === 'weeks',
        isShorthand: unitTokenLower === 'd' || unitTokenLower === 'w',
        usesArticle: quantityToken === 'a' || quantityToken === 'an',
    }
}

const formatRelativeLikeOriginal = (rawLabel, dayDiff) => {
    const parsed = parseRelativeDayWeekToken(rawLabel)
    if (!parsed) return null

    if (dayDiff <= 0) {
        return String(rawLabel).replace(RELATIVE_DAY_WEEK_REGEX, 'today')
    }

    const nextCount = parsed.isWeek ? Math.ceil(dayDiff / 7) : dayDiff
    const countToken = parsed.usesArticle && nextCount === 1 ? 'a' : String(nextCount)

    let unitToken = parsed.unitToken
    if (parsed.isShorthand) {
        unitToken = parsed.isWeek ? 'w' : 'd'
    } else if (parsed.isWeek) {
        unitToken = nextCount === 1 ? 'week' : 'weeks'
    } else {
        unitToken = nextCount === 1 ? 'day' : 'days'
    }

    const replacement = `${countToken} ${unitToken}`
    return String(rawLabel).replace(RELATIVE_DAY_WEEK_REGEX, replacement)
}

const resolveTaskDateWidgetLabel = ({ editor, element, rawLabel, dueDate }) => {
    
    if (!dueDate) return rawLabel || ''

    if (isRelativeDatePast(dueDate)) {
        const pastLabel = formatRelativeTaskDate(dueDate, { fallbackLabel: dueDate })
        return applyTitleLowercaseIntent(pastLabel, editor, element)
    }

    const contextPrefix = readDateContextPrefix(editor, element)
    const isCountdownIntentFromContext = /\bdue\s+in\s*$/.test(contextPrefix)
        || /\bin\s*$/.test(contextPrefix)
    const isCountdownIntentFromRawLabel = Boolean(parseRelativeDayWeekToken(rawLabel))
    const isCountdownIntent = isCountdownIntentFromContext || isCountdownIntentFromRawLabel

    if (isCountdownIntent) {
        const dayDiff = getCalendarDayDifference(new Date(), dueDate)
        if (dayDiff != null) {
            const stylePreserved = formatRelativeLikeOriginal(rawLabel, dayDiff)
            if (stylePreserved) return applyTitleLowercaseIntent(stylePreserved, editor, element)

            if (dayDiff <= 0) return applyTitleLowercaseIntent('today', editor, element)
            if (dayDiff === 1) return applyTitleLowercaseIntent('1 day', editor, element)
            return applyTitleLowercaseIntent(`${dayDiff} days`, editor, element)
        }
    }

    const fallbackLabel = rawLabel || formatRelativeTaskDate(dueDate, { fallbackLabel: dueDate })
    return applyTitleLowercaseIntent(fallbackLabel, editor, element)

}

export {
    resolveTaskDateWidgetLabel,
}
