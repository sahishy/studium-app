import { FaStar, FaBookOpen, FaBrain, FaDumbbell, FaFlask, FaGlobe, FaMedal, FaRocket, FaBoltLightning, FaTrophy } from 'react-icons/fa6'

const CIRCLE_TITLE_MAX = 30;
const CIRCLE_TITLE_MIN = 3;
const CIRCLE_MAX_COUNT = 4;

const CIRCLE_ICON_COLORS = [
    '#1F2937',
    '#ffffff',
    '#9ca3af',
    '#f87171',
    '#fb923c',
    '#fbbf24',
    '#4ade80',
    '#38bdf8',
    '#c084fc',
    '#f472b6',
]

const CIRCLE_BACKGROUND_COLORS = [
    '#9ca3af33',
    '#f8717133',
    '#fb923c33',
    '#fbbf2433',
    '#4ade8033',
    '#38bdf833',
    '#c084fc33',
    '#f472b633',
]

const CIRCLE_ICON_OPTIONS = [
    FaBookOpen,
    FaBoltLightning,
    FaTrophy,
    FaBrain,
    FaRocket,
    FaFlask,
    FaStar,
    FaGlobe,
    FaMedal,
    FaDumbbell,
]

const DEFAULT_CIRCLE_BANNER = {
    bgColor: CIRCLE_BACKGROUND_COLORS[0],
    iconColor: CIRCLE_ICON_COLORS[2],
    iconIndex: 0,
}

const getCircleIcon = (iconIndex = 0) => {
    return CIRCLE_ICON_OPTIONS[iconIndex] ?? CIRCLE_ICON_OPTIONS[0]
}

const getCompetitiveCircle = (circles = []) => {
    if(!Array.isArray(circles)) {
        return null
    }

    return circles.find((circle) => circle?.type === 'competitive') ?? null
}

export {
    CIRCLE_ICON_COLORS,
    CIRCLE_BACKGROUND_COLORS,
    CIRCLE_ICON_OPTIONS,
    DEFAULT_CIRCLE_BANNER,
    CIRCLE_TITLE_MAX,
    CIRCLE_TITLE_MIN,
    CIRCLE_MAX_COUNT,
    getCircleIcon,
    getCompetitiveCircle,
}