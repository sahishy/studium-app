import { formatRelativeTaskDate, toDateFromRelativeInput } from '../../../shared/utils/formatters'

const EMPTY_TEXT_SEGMENT = { type: 'text', rawText: '', displayText: '' }

const makeSegmentId = () => `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const normalizeTitleShape = (title) => {
    if (title && typeof title === 'object' && Array.isArray(title.segments)) return title
    return { segments: [EMPTY_TEXT_SEGMENT] }
}

const ensureTitleSetter = (setTitle) => {
    if (typeof setTitle !== 'function') throw new Error('Widget control update requires setTitle')
    return setTitle
}

const findWidgetIndex = (title, widgetType) => normalizeTitleShape(title).segments
    .findIndex((segment) => segment?.type === 'widget' && segment?.widgetType === widgetType)

const getWidgetSegment = (title, widgetType) => {
    const normalized = normalizeTitleShape(title)
    return normalized.segments.find((segment) => segment?.type === 'widget' && segment?.widgetType === widgetType) || null
}

const upsertWidget = ({ title, widgetType, builder }) => {
    const normalized = normalizeTitleShape(title)
    const segments = [...normalized.segments]
    const idx = findWidgetIndex(normalized, widgetType)
    if (idx >= 0) segments[idx] = builder(segments[idx])
    else segments.push(builder(null))
    return { ...normalized, segments }
}

const removeWidget = ({ title, widgetType }) => {
    const normalized = normalizeTitleShape(title)
    const nextSegments = normalized.segments.filter((segment) => !(segment?.type === 'widget' && segment?.widgetType === widgetType))
    return { ...normalized, segments: nextSegments.length ? nextSegments : [EMPTY_TEXT_SEGMENT] }
}

const dateToIsoKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const getDateControlState = (title) => {
    const dateWidget = getWidgetSegment(title, 'date')
    const dueDate = dateWidget?.value?.dueDate || ''
    const date = dueDate ? toDateFromRelativeInput(dueDate) : null
    const selectedDate = date ? { seconds: Math.floor(date.getTime() / 1000) } : -1
    const dueLabel = dueDate ? formatRelativeTaskDate(dueDate, { fallbackLabel: dueDate }) : ''
    return { selectedDate, dueLabel, dueDate }
}

const buildDateWidgetSegment = ({ currentSegment, date, toLabel = (label) => label }) => {
    const iso = dateToIsoKey(date)
    const relativeLabel = toLabel(formatRelativeTaskDate(iso, { fallbackLabel: iso }))
    return {
        id: currentSegment?.id || makeSegmentId(),
        type: 'widget',
        widgetType: 'date',
        rawText: relativeLabel,
        displayText: relativeLabel,
        value: { ...(currentSegment?.value || {}), dueDate: iso },
    }
}

const buildCircleOptions = (circles = [], { truncate = false } = {}) => {
    const truncateOption = (s) => (s.length <= 25 ? s : `${s.substring(0, 25)}...`)
    return [
        { uid: null, label: 'None', icon: null },
        ...circles.map((circle) => ({
            uid: circle.uid,
            label: truncate ? truncateOption(circle.title) : circle.title,
            icon: null,
        })),
    ]
}

const getCircleControlState = ({ title, circles = [], ownerType, ownerId }) => {
    const circleWidget = getWidgetSegment(title, 'circle')
    const selectedCircleId = circleWidget?.value?.circleId || (ownerType === 'circle' ? ownerId : '')
    const selectedCircle = circles.find((x) => String(x.uid) === String(selectedCircleId)) ?? { title: 'Unknown' }
    return { selectedCircleId, selectedCircle }
}

const buildCircleWidgetSegment = ({ currentSegment, circleId, circles = [], fallbackLabel = '' }) => {
    const resolvedTitle = circles.find((x) => String(x.uid) === String(circleId))?.title || String(fallbackLabel || '')
    return {
        id: currentSegment?.id || makeSegmentId(),
        type: 'widget',
        widgetType: 'circle',
        rawText: resolvedTitle,
        displayText: resolvedTitle,
        value: { ...(currentSegment?.value || {}), circleId, title: resolvedTitle },
    }
}

const buildCourseOptions = (courses = []) => [
    { uid: null, label: 'None', icon: null },
    ...courses.map((course) => ({ uid: String(course.courseId), label: course.title, icon: null, course })),
]

const getCourseControlState = ({ title, courses = [] }) => {
    const courseWidget = getWidgetSegment(title, 'course')
    const selectedCourseId = String(courseWidget?.value?.courseId || '')
    const selectedCourse = courses.find((course) => String(course.courseId) === selectedCourseId) ?? { title: 'Unknown' }
    return { selectedCourseId, selectedCourse }
}

const buildCourseWidgetSegment = ({ currentSegment, courseId, courses = [], fallbackLabel = '', toLabel = (label) => label }) => {
    const course = courses.find((x) => String(x.courseId) === String(courseId))
    const courseTitle = course?.title || String(fallbackLabel || '')
    const resolvedTitle = toLabel(courseTitle)
    return {
        id: currentSegment?.id || makeSegmentId(),
        type: 'widget',
        widgetType: 'course',
        rawText: resolvedTitle,
        displayText: resolvedTitle,
        value: {
            ...(currentSegment?.value || {}),
            courseId: String(courseId),
            title: courseTitle,
            subject: course?.subject || '',
        },
    }
}

export {
    ensureTitleSetter,
    getWidgetSegment,
    upsertWidget,
    removeWidget,
    getDateControlState,
    buildDateWidgetSegment,
    buildCircleOptions,
    getCircleControlState,
    buildCircleWidgetSegment,
    buildCourseOptions,
    getCourseControlState,
    buildCourseWidgetSegment,
}
