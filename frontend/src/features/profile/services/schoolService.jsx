import highschools from '../../../data/highschools.json'

const getSchools = () => {
    return Array.isArray(highschools) ? [...highschools] : []
}

const getSchoolNameById = (schoolId) => {
    const school = highschools.find((item) => item.highSchoolId === schoolId)
    return school?.name ?? null
}

const getEffectiveSchoolIds = ({ schoolId = null, schoolAffiliations = [] } = {}) => {
    return Array.from(new Set([
        schoolId,
        ...(Array.isArray(schoolAffiliations) ? schoolAffiliations : []),
    ].filter(Boolean).map((value) => String(value))))
}

export {
    getSchools,
    getSchoolNameById,
    getEffectiveSchoolIds,
}