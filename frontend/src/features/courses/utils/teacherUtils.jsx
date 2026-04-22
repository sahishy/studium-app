import { hasFlaggedWords } from '../../../shared/services/censorService'

const BLOCKED_TITLES = new Set(['mr', 'mrs', 'ms', 'dr'])

const validateTeacherName = (teacherName) => {
    const normalizedTeacherName = String(teacherName ?? '').trim()

    if(!normalizedTeacherName) {
        return { isValid: false, error: 'Please enter the name in the format "First Last"' }
    }

    if(hasFlaggedWords(normalizedTeacherName)) {
        return { isValid: false, error: 'Name flagged as inappropriate.' }
    }

    const nameParts = normalizedTeacherName.split(/\s+/).filter(Boolean)
    if(nameParts.length !== 2) {
        return { isValid: false, error: 'Please enter the name in the format "First Last"' }
    }

    const hasBlockedTitle = nameParts.some((part) => {
        const normalizedPart = String(part).toLowerCase().replace(/\./g, '')
        return BLOCKED_TITLES.has(normalizedPart)
    })

    if(hasBlockedTitle) {
        return { isValid: false, error: 'Please enter the name without titles, in the format "First Last"' }
    }

    return { isValid: true, error: '' }
}

export {
    validateTeacherName,
}
