const pad = (value) => String(value).padStart(2, '0')

const dateToIsoKey = (date) => (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
)

const addDays = (date, amount) => {
    const next = new Date(date)
    next.setDate(next.getDate() + amount)
    return next
}

const startOfWeek = (date) => {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    result.setDate(result.getDate() - result.getDay())
    return result
}

const buildCalendarDays = (anchor, mode = 'week') => {
    if (mode === 'week') {
        const start = startOfWeek(anchor)
        return Array.from({ length: 7 }, (_, index) => addDays(start, index))
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const start = startOfWeek(first)
    return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

export { addDays, buildCalendarDays, dateToIsoKey, startOfWeek }
