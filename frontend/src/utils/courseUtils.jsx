import { BiMath } from "react-icons/bi"
import { FaGlobeAmericas, FaPaintBrush } from "react-icons/fa"
import { FaBookBookmark, FaBuilding, FaDumbbell, FaFlask, FaGlobe, FaMasksTheater, FaMusic, FaUser, FaUserGraduate } from "react-icons/fa6"

// tailwind colors 400/100
const COURSE_COLORS = [
    { icon: '#9ca3af', bg: '#f3f4f6' },
    { icon: '#f87171', bg: '#fee2e2' },
    { icon: '#fb923c', bg: '#ffedd5' },
    { icon: '#fbbf24', bg: '#fef3c7' },
    { icon: '#4ade80', bg: '#dcfce7' },
    { icon: '#38bdf8', bg: '#e0f2fe' },
    { icon: '#c084fc', bg: '#f3e8ff' },
    { icon: '#f472b6', bg: '#fce7f3' },
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