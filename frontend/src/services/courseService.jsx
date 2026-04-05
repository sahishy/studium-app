import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import coursesCatalog from '../data/courses.json'

const subjectColorMap = {
    Admin: '#7c3aed',
    English: '#2563eb',
    Art: '#db2777',
    Music: '#ea580c',
    'Theater Arts': '#9333ea',
    'World Languages and Culture': '#0891b2',
    'Health and PE': '#16a34a',
    Math: '#4f46e5',
    Science: '#059669',
    'Social Science and Global Studies': '#0f766e',
    'Career and Technical Education': '#b45309'
}

const getAllCourses = () => {
    return coursesCatalog
}

const getCourseById = (courseId) => {
    return coursesCatalog.find((course) => course.courseId === String(courseId)) ?? null
}

const getCoursesBySubject = (subject) => {
    return coursesCatalog.filter((course) => course.subject === subject)
}

const getCourseSubjects = () => {
    return Array.from(new Set(coursesCatalog.map((course) => course.subject))).sort((a, b) => a.localeCompare(b))
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

const searchCourses = (queryText = '', options = {}) => {
    const { subject = null, excludeCourseIds = [] } = options

    const query = normalizeSearchText(queryText)
    const excluded = new Set((excludeCourseIds ?? []).map((courseId) => String(courseId)))

    return coursesCatalog
        .map((course) => {
            if(excluded.has(String(course.courseId))) {
                return null
            }

            if(subject && course.subject !== subject) {
                return null
            }

            if(!query) {
                return { course, rank: 0 }
            }

            const queryTokens = tokenizeText(query)
            const normalizedTitle = normalizeSearchText(course.title)
            const titleTokens = tokenizeText(course.title)
            const descriptionLeadTokens = tokenizeText(course.description).slice(0, 10)
            const subjectTokens = tokenizeText(course.subject)
            const tagTokens = tokenizeText((course.tags ?? []).join(' '))
            const normalizedCourseId = normalizeSearchText(course.courseId)

            let titleTokenMatches = 0
            let descriptionLeadMatches = 0
            let subjectTokenMatches = 0
            let tagTokenMatches = 0
            let courseIdTokenMatches = 0

            for(const queryToken of queryTokens) {
                const titleMatch = titleTokens.some((token) => token.startsWith(queryToken))
                const descriptionLeadMatch = descriptionLeadTokens.some((token) => token.startsWith(queryToken))
                const subjectMatch = subjectTokens.some((token) => token.startsWith(queryToken))
                const tagMatch = tagTokens.some((token) => token.startsWith(queryToken))
                const courseIdMatch = normalizedCourseId.includes(queryToken)

                if(!titleMatch && !descriptionLeadMatch && !subjectMatch && !tagMatch && !courseIdMatch) {
                    return null
                }

                if(titleMatch) titleTokenMatches += 1
                if(descriptionLeadMatch) descriptionLeadMatches += 1
                if(subjectMatch) subjectTokenMatches += 1
                if(tagMatch) tagTokenMatches += 1
                if(courseIdMatch) courseIdTokenMatches += 1
            }

            const titleStartsWithMatch = normalizedTitle.startsWith(query)
            const titleIncludesMatch = normalizedTitle.includes(query)
            const fullTitleTokenCoverage = titleTokenMatches === queryTokens.length

            let rank = 0
            if(titleStartsWithMatch) rank += 240
            if(titleIncludesMatch) rank += 140
            if(fullTitleTokenCoverage) rank += 180

            rank += titleTokenMatches * 150
            rank += descriptionLeadMatches * 90
            rank += subjectTokenMatches * 60
            rank += tagTokenMatches * 50
            rank += courseIdTokenMatches * 50

            return { course, rank }
        })
        .filter(Boolean)
        .sort((a, b) => {
            if(query && b.rank !== a.rank) {
                return b.rank - a.rank
            }
            return a.course.title.localeCompare(b.course.title)
        })
        .map(({ course }) => course)
}

const getFeaturedCourses = (options = {}) => {
    const { subject = null, excludeCourseIds = [], limit = 8 } = options
    const filtered = searchCourses('', { subject, excludeCourseIds })

    const shuffled = filtered
        .slice()
        .sort(() => Math.random() - 0.5)

    return shuffled.slice(0, limit)
}

const getCoursesByIds = (courseIds = []) => {
    if(!Array.isArray(courseIds) || courseIds.length === 0) {
        return []
    }

    return courseIds
        .map((courseId) => getCourseById(courseId))
        .filter(Boolean)
}

const getAvailableCoursesByCourseIds = (courseIds = []) => {
    const selected = new Set((courseIds ?? []).map((courseId) => String(courseId)))
    return coursesCatalog.filter((course) => !selected.has(String(course.courseId)))
}

const getSubjectColor = (subject) => {
    return subjectColorMap[subject] ?? '#64748b'
}

const buildEnrollmentId = (courseId, studentId) => {
    return `${String(courseId)}_${String(studentId)}`
}

const joinCourse = async (studentId, courseId, options = {}) => {
    const db = getFirestore()
    const now = serverTimestamp()
    const {
        day = 'A',
        teacherId = null,
        customization = { bgColor: '#1f2937', iconColor: '#ffffff' }
    } = options
    const enrollmentId = buildEnrollmentId(courseId, studentId)
    const enrollmentRef = doc(db, 'courses', enrollmentId)
    const existingEnrollment = await getDoc(enrollmentRef)

    if(existingEnrollment.exists()) {
        await setDoc(enrollmentRef, {
            courseId: String(courseId),
            studentId: String(studentId),
            day: day === 'B' ? 'B' : 'A',
            teacherId: teacherId ? String(teacherId) : null,
            customization: {
                bgColor: customization?.bgColor ?? '#1f2937',
                iconColor: customization?.iconColor ?? '#ffffff'
            },
            lastUpdated: now
        }, { merge: true })
    } else {
        await setDoc(enrollmentRef, {
            courseId: String(courseId),
            studentId: String(studentId),
            day: day === 'B' ? 'B' : 'A',
            teacherId: teacherId ? String(teacherId) : null,
            customization: {
                bgColor: customization?.bgColor ?? '#1f2937',
                iconColor: customization?.iconColor ?? '#ffffff'
            },
            createdAt: now,
            lastUpdated: now
        })
    }

    return enrollmentId
}

const leaveCourse = async (studentId, courseId) => {
    const db = getFirestore()
    const enrollmentId = buildEnrollmentId(courseId, studentId)
    const enrollmentRef = doc(db, 'courses', enrollmentId)

    await deleteDoc(enrollmentRef)
}

const isStudentInCourse = async (studentId, courseId) => {
    const db = getFirestore()
    const enrollmentId = buildEnrollmentId(courseId, studentId)
    const enrollmentRef = doc(db, 'courses', enrollmentId)
    const enrollmentSnap = await getDoc(enrollmentRef)

    return enrollmentSnap.exists()
}

const getStudentCourseIds = async (studentId) => {
    const db = getFirestore()
    const coursesRef = collection(db, 'courses')
    const q = query(coursesRef, where('studentId', '==', String(studentId)))
    const snapshot = await getDocs(q)

    return snapshot.docs.map((courseDoc) => courseDoc.data().courseId)
}

const getAvailableCoursesForStudent = async (studentId) => {
    if(!studentId) {
        return getAllCourses()
    }

    const courseIds = await getStudentCourseIds(studentId)
    return getAvailableCoursesByCourseIds(courseIds)
}

const toggleCourseEnrollment = async (studentId, courseId) => {
    const enrolled = await isStudentInCourse(studentId, courseId)

    if(enrolled) {
        await leaveCourse(studentId, courseId)
        return { enrolled: false, courseId: String(courseId) }
    }

    await joinCourse(studentId, courseId)
    return { enrolled: true, courseId: String(courseId) }
}

const useStudentCourses = (studentId) => {
    const [enrollments, setEnrollments] = useState([])

    useEffect(() => {
        if(!studentId) {
            setEnrollments([])
            return
        }

        const db = getFirestore()
        const coursesRef = collection(db, 'courses')
        const q = query(coursesRef, where('studentId', '==', String(studentId)))

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((courseDoc) => ({
                uid: courseDoc.id,
                ...courseDoc.data()
            }))

            setEnrollments(data)
        })

        return () => unsubscribe()
    }, [studentId])

    const courseIds = useMemo(() => {
        return enrollments.map((enrollment) => enrollment.courseId)
    }, [enrollments])

    const courses = useMemo(() => {
        return courseIds
            .map((courseId) => getCourseById(courseId))
            .filter(Boolean)
    }, [courseIds])

    return { enrollments, courseIds, courses }
}

const useCourseLibrary = (studentId) => {
    const { enrollments, courseIds, courses } = useStudentCourses(studentId)

    const availableCourses = useMemo(() => {
        return getAvailableCoursesByCourseIds(courseIds)
    }, [courseIds])

    return {
        enrollments,
        courseIds,
        selectedCourses: courses,
        availableCourses
    }
}

export {
    getAllCourses,
    getCourseById,
    getCoursesBySubject,
    getCourseSubjects,
    searchCourses,
    getFeaturedCourses,
    getCoursesByIds,
    getAvailableCoursesByCourseIds,
    getSubjectColor,
    joinCourse,
    leaveCourse,
    toggleCourseEnrollment,
    isStudentInCourse,
    getStudentCourseIds,
    getAvailableCoursesForStudent,
    useStudentCourses,
    useCourseLibrary
}
