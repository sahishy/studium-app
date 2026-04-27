import majors from '../../../data/majors.json'

const normalizeText = (value = '') => String(value).trim().toLowerCase()

const getMajors = () => {
    return Array.isArray(majors) ? [...majors] : []
}

const getMajorNameById = (majorId) => {
    const major = majors.find((item) => item.majorId === majorId)
    return major?.name ?? null
}

const searchMajors = (query = '', limit = 150) => {
    const normalizedQuery = normalizeText(query)

    if(!normalizedQuery) {
        return getMajors().slice(0, limit)
    }

    const result = majors.filter((major) => {
        const name = normalizeText(major?.name)
        const metaMajor = normalizeText(major?.metaMajor)
        const majorId = normalizeText(major?.majorId)

        return (
            name.includes(normalizedQuery)
            || metaMajor.includes(normalizedQuery)
            || majorId.includes(normalizedQuery)
        )
    })

    return result.slice(0, limit)
}

export {
    getMajors,
    getMajorNameById,
    searchMajors,
}