import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import coursesCatalog from '../../../data/courses.json'
import { buildEnrollmentId, normalizeSearchText, tokenizeText } from '../utils/courseUtils'
import { db } from '../../../lib/firebase'

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

const joinCourse = async (studentId, courseId, options = {}) => {

    const now = serverTimestamp()
    const {
        day = 'A',
        teacherId = null,
        customization = { color: '#ffffff' }
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
                color: customization?.color ?? '#ffffff'
            },
            lastUpdated: now
        }, { merge: true })
    } else {
        
        const coursesRef = collection(db, 'courses')
        const studentCoursesQuery = query(coursesRef, where('studentId', '==', String(studentId)))
        const studentCoursesSnapshot = await getDocs(studentCoursesQuery)
        const sortIndex = studentCoursesSnapshot.size

        await setDoc(enrollmentRef, {
            courseId: String(courseId),
            studentId: String(studentId),
            day: day === 'B' ? 'B' : 'A',
            teacherId: teacherId ? String(teacherId) : null,
            customization: {
                color: customization?.color ?? '#ffffff'
            },
            sortIndex,
            createdAt: now,
            lastUpdated: now
        })
    }

    return enrollmentId

}

const leaveCourse = async (studentId, courseId) => {

    const enrollmentId = buildEnrollmentId(courseId, studentId)
    const enrollmentRef = doc(db, 'courses', enrollmentId)

    await deleteDoc(enrollmentRef)

}

const isStudentInCourse = async (studentId, courseId) => {

    const enrollmentId = buildEnrollmentId(courseId, studentId)
    const enrollmentRef = doc(db, 'courses', enrollmentId)
    const enrollmentSnap = await getDoc(enrollmentRef)

    return enrollmentSnap.exists()

}

const getStudentCourseIds = async (studentId) => {

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
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if(!studentId) {
            setEnrollments([])
            setLoading(false)
            return
        }

        setLoading(true)

        const coursesRef = collection(db, 'courses')
        const q = query(coursesRef, where('studentId', '==', String(studentId)))

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((courseDoc) => ({
                uid: courseDoc.id,
                ...courseDoc.data()
            }))

            setEnrollments(data)
            setLoading(false)
        }, () => {
            setLoading(false)
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

    return { enrollments, courseIds, courses, loading }

}

const useCourseLibrary = (studentId) => {

    const { enrollments, courseIds, courses, loading } = useStudentCourses(studentId)

    const availableCourses = useMemo(() => {
        return getAvailableCoursesByCourseIds(courseIds)
    }, [courseIds])

    return {
        enrollments,
        courseIds,
        selectedCourses: courses,
        availableCourses,
        loading
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
    joinCourse,
    leaveCourse,
    toggleCourseEnrollment,
    isStudentInCourse,
    getStudentCourseIds,
    getAvailableCoursesForStudent,
    useStudentCourses,
    useCourseLibrary
}
