import { createContext, useContext } from 'react'
import { useCourseLibrary } from '../services/courseService'

const CoursesContext = createContext({
    enrollments: [],
    courseIds: [],
    courses: [],
    selectedCourses: [],
    availableCourses: []
})

const CoursesProvider = ({ profile, children }) => {
    const { enrollments, courseIds, selectedCourses, availableCourses } = useCourseLibrary(profile?.uid)

    return (
        <CoursesContext.Provider
            value={{
                enrollments,
                courseIds,
                courses: selectedCourses,
                selectedCourses,
                availableCourses
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
