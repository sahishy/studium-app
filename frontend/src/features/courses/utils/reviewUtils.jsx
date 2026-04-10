import highschools from '../../../data/highschools.json'
import { FaThumbsUp, FaHandshake, FaThumbsDown } from 'react-icons/fa6'

const SCORE_OPTIONS = [
    { value: 1, label: 'Good', icon: FaThumbsUp },
    { value: 0.5, label: 'Okay', icon: FaHandshake },
    { value: 0, label: 'Bad', icon: FaThumbsDown },
]

const clampReviewScore = (score) => {
    if(score === 0 || score === 0.5 || score === 1) {
        return score
    }

    return 0.5
}

const computeAverageScoreFromReviews = (reviews = []) => {
    if(!reviews.length) {
        return null
    }

    const total = reviews.reduce((sum, review) => sum + Number(review?.score ?? 0), 0)
    return total / reviews.length
}

const buildCourseScoreMap = (reviews = []) => {
    const buckets = new Map()

    reviews.forEach((review) => {
        const courseId = String(review?.courseId ?? '')
        if(!courseId) return

        const previous = buckets.get(courseId) ?? { total: 0, count: 0 }
        previous.total += Number(review?.score ?? 0)
        previous.count += 1
        buckets.set(courseId, previous)
    })

    const scoreMap = {}
    buckets.forEach((value, courseId) => {
        scoreMap[courseId] = value.count > 0 ? value.total / value.count : null
    })

    return scoreMap
}

const formatScoreLabel = (score) => {
    if(score == null) {
        return 'No Reviews'
    }

    return `${Math.round(score * 100)}%`
}

const sortReviewsBySchoolPriority = (reviews = [], schoolIds = []) => {
    const normalizedSchoolIds = new Set((Array.isArray(schoolIds) ? schoolIds : [schoolIds]).filter(Boolean).map((schoolId) => String(schoolId)))

    return [...reviews].sort((a, b) => {
        const aMatch = normalizedSchoolIds.has(String(a?.schoolId ?? '')) ? 1 : 0
        const bMatch = normalizedSchoolIds.has(String(b?.schoolId ?? '')) ? 1 : 0
        if(bMatch !== aMatch) {
            return bMatch - aMatch
        }

        const aTime = a?.lastUpdated?.seconds ?? a?.createdAt?.seconds ?? 0
        const bTime = b?.lastUpdated?.seconds ?? b?.createdAt?.seconds ?? 0
        return bTime - aTime
    })
}

const getSchoolNameById = (schoolId) => {
    if(!schoolId) {
        return 'Unknown School'
    }

    const found = highschools.find((school) => String(school.highSchoolId) === String(schoolId))
    return found?.name ?? 'Unknown School'
}

export {
    clampReviewScore,
    computeAverageScoreFromReviews,
    buildCourseScoreMap,
    formatScoreLabel,
    sortReviewsBySchoolPriority,
    getSchoolNameById,
    SCORE_OPTIONS
}