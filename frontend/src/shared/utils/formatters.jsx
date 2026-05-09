const DATE_MS = {
    day: 86400000,
    week: 604800000,
    year: 31536000000,
};

const toDateFromSeconds = (seconds) => new Date(seconds * 1000);

const toDateKeyFromSeconds = (seconds) => toDateFromSeconds(seconds).toLocaleDateString();

const formatDateFromSeconds = (seconds) => toDateFromSeconds(seconds).toLocaleDateString();

const toTitleCase = (value = '') => String(value ?? '')
    // .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const toDateFromFirestoreLike = (value) => {
    if(!value) {
        return null
    }

    if(value instanceof Date) {
        return value
    }

    if(value?.toDate) {
        return value.toDate()
    }

    if(typeof value === 'number' || typeof value === 'string') {
        const dateValue = new Date(value)
        return Number.isNaN(dateValue.getTime()) ? null : dateValue
    }

    return null
}

const formatDurationMmSs = (totalSeconds = 0) => {
    const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
    const minutes = Math.floor(safeSeconds / 60)
    const seconds = safeSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const toMillisFromFirestoreLike = (value) => {
    const dateValue = toDateFromFirestoreLike(value)
    return dateValue ? dateValue.getTime() : 0
}

const formatTimeFromFirestoreLike = (value, options = { hour: 'numeric', minute: '2-digit' }) => {
    const dateValue = toDateFromFirestoreLike(value)
    return dateValue ? dateValue.toLocaleTimeString([], options) : ''
}

const toDateFromRelativeInput = (value) => {
    if(value == null) return null

    if(value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value
    }

    if(typeof value === 'number') {
        return new Date(value * 1000)
    }

    if(typeof value === 'string') {
        const trimmed = value.trim()
        if(!trimmed) return null

        const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        if(isoDateMatch) {
            const year = Number(isoDateMatch[1])
            const monthIndex = Number(isoDateMatch[2]) - 1
            const day = Number(isoDateMatch[3])
            const localDate = new Date(year, monthIndex, day)
            return Number.isNaN(localDate.getTime()) ? null : localDate
        }

        const parsed = new Date(trimmed)
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    if(typeof value === 'object' && typeof value.seconds === 'number') {
        return new Date(value.seconds * 1000)
    }

    return null
}

const toStartOfDay = (value) => {
    const date = value instanceof Date ? new Date(value) : toDateFromRelativeInput(value)
    if(!date) return null
    date.setHours(0, 0, 0, 0)
    return date
}

const getCalendarDayDifference = (fromValue, toValue) => {
    const from = toStartOfDay(fromValue)
    const to = toStartOfDay(toValue)
    if(!from || !to) return null

    const msPerDay = DATE_MS.day
    return Math.round((to.getTime() - from.getTime()) / msPerDay)
}

const isRelativeDatePast = (value, nowValue = new Date()) => {
    const dayDiff = getCalendarDayDifference(nowValue, value)
    if(dayDiff == null) return false
    return dayDiff < 0
}

const formatMonthDayOrdinal = (date) => {
    const day = date.getDate();
    let suffix = 'th';
    if(!(day % 100 >= 10 && day % 100 <= 19)) {
        if(day % 10 === 1) suffix = 'st';
        else if(day % 10 === 2) suffix = 'nd';
        else if(day % 10 === 3) suffix = 'rd';
    }

    const monthDay = date.toLocaleDateString('default', { day: 'numeric', month: 'long' });
    return `${monthDay}${suffix}`;
}

const formatRelativeTaskDate = (value, options = {}) => {
    const { fallbackLabel = '' } = options
    const target = toDateFromRelativeInput(value)
    if(!target) return fallbackLabel

    const now = Date.now();
    const dateMs = target.getTime();
    const today = new Date(now);

    const isSameDay = (a, b) => a.toDateString() === b.toDateString();

    if(isSameDay(today, target)) return 'Today';
    if(isSameDay(new Date(now + DATE_MS.day), target)) return 'Tomorrow';
    if(isSameDay(new Date(now - DATE_MS.day), target)) return 'Yesterday';

    const diff = dateMs - now;

    if(diff < 0) {
        return formatMonthDayOrdinal(target);
    }

    if(diff < DATE_MS.week) {
        return target.toLocaleDateString('default', { weekday: 'long' });
    }

    if(diff < 2 * DATE_MS.week) {
        const weekday = target.toLocaleDateString('default', { weekday: 'long' });
        return `Next ${weekday}`;
    }

    if(diff < DATE_MS.year) {
        return formatMonthDayOrdinal(target);
    }

    return formatMonthDayOrdinal(target);
}

export {
    toDateFromSeconds,
    toDateKeyFromSeconds,
    formatDateFromSeconds,
    formatRelativeTaskDate,
    formatDurationMmSs,
    formatTimeFromFirestoreLike,
    toDateFromFirestoreLike,
    toDateFromRelativeInput,
    toStartOfDay,
    getCalendarDayDifference,
    isRelativeDatePast,
    toMillisFromFirestoreLike,
    toTitleCase,
}