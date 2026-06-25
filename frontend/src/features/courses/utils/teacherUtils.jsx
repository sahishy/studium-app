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

const normalizeTeacherName = (value = '') => {
    return String(value ?? '').trim().replace(/\s+/g, ' ')
}

const tokenizeTeacherName = (value = '') => {
    return normalizeTeacherName(value)
        .toLowerCase()
        .split(' ')
        .filter(Boolean)
}

const scoreTeacherMatch = (teacher, normalizedQuery = '') => {
    if(!normalizedQuery) {
        return 0
    }

    const queryTokens = tokenizeTeacherName(normalizedQuery)
    if(queryTokens.length === 0) {
        return 0
    }

    const teacherName = String(teacher?.nameLowercase ?? teacher?.name ?? '').toLowerCase()
    const teacherTokens = tokenizeTeacherName(teacherName)

    let tokenPrefixMatches = 0
    let tokenIncludesMatches = 0

    for(const queryToken of queryTokens) {
        const hasTokenPrefixMatch = teacherTokens.some((token) => token.startsWith(queryToken))
        const hasTokenIncludesMatch = teacherTokens.some((token) => token.includes(queryToken))
        const hasNameIncludesMatch = teacherName.includes(queryToken)

        if(!hasTokenPrefixMatch && !hasTokenIncludesMatch && !hasNameIncludesMatch) {
            return -1
        }

        if(hasTokenPrefixMatch) tokenPrefixMatches += 1
        if(!hasTokenPrefixMatch && (hasTokenIncludesMatch || hasNameIncludesMatch)) tokenIncludesMatches += 1
    }

    let rank = 0
    if(teacherName.startsWith(normalizedQuery)) rank += 200
    if(teacherName.includes(normalizedQuery)) rank += 140
    rank += tokenPrefixMatches * 120
    rank += tokenIncludesMatches * 70

    return rank
}

export {
    validateTeacherName,
    normalizeTeacherName,
    scoreTeacherMatch,
}
