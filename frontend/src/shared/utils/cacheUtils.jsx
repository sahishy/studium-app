const CACHE_NAMESPACES = {
    COURSE_SCORE: 'course-score',
    COURSE_ENROLLMENTS: 'course-enrollments',
    COURSE_TEACHERS_MAP: 'course-teachers-map',
    TASK_PENDING_PATCH: 'task-pending-patch',
}

const CACHE_TTLS_MS = {
    COURSE_SCORE: 60 * 1000,
    COURSE_ENROLLMENTS: 5 * 60 * 1000,
    COURSE_TEACHERS_MAP: 5 * 60 * 1000,
}

const CACHE_DEBOUNCE_MS = {
    TASK_PATCH_FLUSH: 3000,
}

const CACHE_STORAGE_KEYS = {
    TASK_PENDING_OPS: 'agenda:task-pending-ops',
}

export {
    CACHE_NAMESPACES,
    CACHE_TTLS_MS,
    CACHE_DEBOUNCE_MS,
    CACHE_STORAGE_KEYS,
}