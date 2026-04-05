import { createContext, useContext } from 'react'
import { useCourseLibrary } from '../services/courseService'

const CoursesContext = createContext({
    enrollments: [],
    courseIds: [],
    courses: [],
    selectedCourses: [],
    availableCourses: [],
    loading: false
})

const CoursesProvider = ({ profile, children }) => {
    const { enrollments, courseIds, selectedCourses, availableCourses, loading } = useCourseLibrary(profile?.uid)

    return (
        <CoursesContext.Provider
            value={{
                enrollments,
                courseIds,
                courses: selectedCourses,
                selectedCourses,
                availableCourses,
                loading
            }}
        >
            {children}
        </CoursesContext.Provider>
    )
}

const useCourses = () => useContext(CoursesContext)

export {
    CoursesProvider,
    useCourses
}
