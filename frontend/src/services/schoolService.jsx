import highschools from '../data/highschools.json'

const getSchoolNameById = (schoolId) => {
    const school = highschools.find((item) => item.highSchoolId === schoolId)
    return school?.name ?? null
}

export {
    getSchoolNameById,
}