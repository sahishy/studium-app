import highschools from '../data/highschools.json'

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

const sortReviewsBySchoolPriority = (reviews = [], schoolId = null) => {
    const normalizedSchoolId = schoolId ? String(schoolId) : null

    return [...reviews].sort((a, b) => {
        const aMatch = normalizedSchoolId && String(a?.schoolId ?? '') === normalizedSchoolId ? 1 : 0
        const bMatch = normalizedSchoolId && String(b?.schoolId ?? '') === normalizedSchoolId ? 1 : 0
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
}