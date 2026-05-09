import { BiMath } from "react-icons/bi"
import { FaGlobeAmericas, FaPaintBrush } from "react-icons/fa"
import { FaBookBookmark, FaBuilding, FaDumbbell, FaFlask, FaGlobe, FaMasksTheater, FaMusic, FaUser, FaUserGraduate } from "react-icons/fa6"

// tailwind colors 400/100
const COURSE_COLORS = [
    '#9ca3af',
    '#f87171',
    '#fb923c',
    '#fbbf24',
    '#4ade80',
    '#38bdf8',
    '#c084fc',
    '#f472b6'
]

const SUBJECT_ICONS = {
    'Admin': FaUser,
    'English': FaBookBookmark,
    'Art': FaPaintBrush,
    'Music': FaMusic,
    'Theater Arts': FaMasksTheater,
    'World Languages and Culture': FaGlobe,
    'Health and PE': FaDumbbell,
    'Math': BiMath,
    'Science': FaFlask,
    'Social Science and Global Studies': FaGlobeAmericas,
    'Career and Technical Education': FaUserGraduate,
    'MATA': FaBuilding
}

const normalizeSearchText = (value) => {
    return String(value ?? '')
        .toLowerCase()
        .replace(/([0-9])([a-z])/g, '$1 $2')
        .replace(/([a-z])([0-9])/g, '$1 $2')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

const tokenizeText = (value) => {
    const normalized = normalizeSearchText(value)
    return normalized ? normalized.split(' ') : []
}

const buildEnrollmentId = (courseId, studentId) => {
    return `${String(courseId)}_${String(studentId)}`
}

export {
    COURSE_COLORS,
    SUBJECT_ICONS,
    normalizeSearchText,
    tokenizeText,
    buildEnrollmentId
}