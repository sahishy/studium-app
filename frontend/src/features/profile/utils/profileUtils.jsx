const SAT_MIN = 400
const SAT_MAX = 1600
const ACT_MIN = 1
const ACT_MAX = 36
const GPA_MIN = 0
const GPA_MAX = 5

const getDraftAcademicFromStats = ({ userStats, displayName = '' }) => {
    
    const academic = userStats?.academic ?? {}

    return {
        displayName,
        targetMajors: Array.isArray(academic.targetMajors) ? academic.targetMajors : [],
        sat: academic?.scores?.sat ?? '',
        act: academic?.scores?.act ?? '',
        unweightedGpa: academic?.gpa?.unweighted ?? '',
        weightedGpa: academic?.gpa?.weighted ?? '',
    }

}

const getParsedNumber = (value) => {

    if(value === '' || value === null || value === undefined) {
        return null
    }

    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null

}

const isNumberInRange = (value, min, max) => {

    if(value === '' || value === null || value === undefined) {
        return true
    }

    const parsed = Number(value)
    if(!Number.isFinite(parsed)) {
        return false
    }

    return parsed >= min && parsed <= max

}

const toModeLabel = (modeId = '') => {

    if(!modeId) {
        return 'Unknown Mode'
    }

    return String(modeId)
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')

}

const validateDisplayNameFormat = (value = '') => {
    
    const trimmed = String(value).trim()

    if(trimmed.length < 3 || trimmed.length > 23) {
        return { isValid: false, error: 'Display name must be between 3 and 23 characters.' }
    }

    if(!/^[A-Za-z0-9]+$/.test(trimmed)) {
        return { isValid: false, error: 'Display name must contain only letters and numbers.' }
    }

    return { isValid: true, error: '' }

}

export {
    SAT_MIN,
    SAT_MAX,
    ACT_MIN,
    ACT_MAX,
    GPA_MIN,
    GPA_MAX,
    getDraftAcademicFromStats,
    getParsedNumber,
    isNumberInRange,
    toModeLabel,
    validateDisplayNameFormat,
}