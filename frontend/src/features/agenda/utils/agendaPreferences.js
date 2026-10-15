const DEFAULT_AGENDA_PREFERENCES = Object.freeze({ list: { groupBy: 'dueDate', layout: 'smart', completionBehavior: 'keep' }, board: { groupBy: 'status' }, calendar: { sortBy: 'status' } })
const VALID_LIST_GROUPS = new Set(['none', 'dueDate', 'course'])
const VALID_BOARD_GROUPS = new Set(['status', 'course', 'dueDate'])
const VALID_CALENDAR_SORTS = new Set(['status', 'course', 'title'])

const resolveAgendaPreferences = (profile) => {
    const nested = profile?.preferences?.agenda?.list?.groupBy
    const legacy = profile?.preferences?.groupTasksBy
    const groupBy = VALID_LIST_GROUPS.has(nested)
        ? nested
        : VALID_LIST_GROUPS.has(legacy) ? legacy : DEFAULT_AGENDA_PREFERENCES.list.groupBy
    const saved = profile?.preferences?.agenda || {}
    return {
        list: {
            groupBy,
            layout: ['smart', 'table'].includes(saved.list?.layout) ? saved.list.layout : 'smart',
            completionBehavior: ['keep', 'delete'].includes(saved.list?.completionBehavior) ? saved.list.completionBehavior : 'keep',
        },
        board: { groupBy: VALID_BOARD_GROUPS.has(saved.board?.groupBy) ? saved.board.groupBy : 'status' },
        calendar: { sortBy: VALID_CALENDAR_SORTS.has(saved.calendar?.sortBy) ? saved.calendar.sortBy : 'status' },
    }
}

export { DEFAULT_AGENDA_PREFERENCES, VALID_BOARD_GROUPS, VALID_CALENDAR_SORTS, VALID_LIST_GROUPS, resolveAgendaPreferences }
