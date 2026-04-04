import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Button from '../../components/main/Button'
import BottomFade from '../../components/main/BottomFade'
import CommandPalette from '../../components/main/CommandPalette'
import CourseCard from '../../components/courses/CourseCard'
import CourseSearchResultRow from '../../components/courses/CourseSearchResultRow'
import CoursePaletteGridCard from '../../components/courses/CoursePaletteGridCard'
import { useCourses } from '../../contexts/CoursesContext'
import { getCourseSubjects, joinCourse, leaveCourse, searchCourses } from '../../services/courseService'

const MyCoursesTab = () => {
    const { profile } = useOutletContext()
    const { selectedCourses = [], courseIds = [] } = useCourses()
    const [loadingCourseId, setLoadingCourseId] = useState(null)
    const [isPaletteOpen, setIsPaletteOpen] = useState(false)
    const [query, setQuery] = useState('')

    const subjects = useMemo(() => getCourseSubjects(), [])
    const [activeSubject, setActiveSubject] = useState(subjects[0] ?? null)

    const normalizedQuery = query.trim()

    const selectedCourseIds = useMemo(() => {
        return new Set(courseIds.map((courseId) => String(courseId)))
    }, [courseIds])

    const subjectCourses = useMemo(() => {
        if (normalizedQuery) {
            return []
        }

        return searchCourses('', {
            subject: activeSubject,
            excludeCourseIds: []
        })
    }, [normalizedQuery, activeSubject])

    const searchResults = useMemo(() => {
        if (!normalizedQuery) {
            return []
        }

        return searchCourses(normalizedQuery, {
            excludeCourseIds: []
        })
    }, [normalizedQuery])

    const openPalette = () => {
        setQuery('')
        setIsPaletteOpen(true)
    }

    const closePalette = () => {
        setIsPaletteOpen(false)
    }

    const handleJoinCourse = async (courseId) => {
        if (!profile?.uid) {
            return
        }

        setLoadingCourseId(String(courseId))
        try {
            await joinCourse(profile.uid, courseId)
            closePalette()
        } finally {
            setLoadingCourseId(null)
        }
    }

    const handleLeaveCourse = async (courseId) => {
        if (!profile?.uid) {
            return
        }

        setLoadingCourseId(String(courseId))
        try {
            await leaveCourse(profile.uid, courseId)
        } finally {
            setLoadingCourseId(null)
        }
    }

    return (
        <>
            <div className='w-full h-full flex flex-col gap-4 lg:flex-row lg:gap-16 lg:items-start m-auto'>
                <div className='flex-1 flex flex-col items-start gap-4 pb-16'>
                    <Button type='secondary' onClick={openPalette}>Add Course</Button>

                    {selectedCourses.length === 0 ? (
                        <p className='text-sm text-neutral1'>You haven&apos;t added any courses yet.</p>
                    ) : (
                        <div className='w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
                            {selectedCourses
                                .slice()
                                .sort((a, b) => a.title.localeCompare(b.title))
                                .map((course) => (
                                    <CourseCard
                                        key={course.courseId}
                                        course={course}
                                        loading={loadingCourseId === String(course.courseId)}
                                        onRemove={() => handleLeaveCourse(course.courseId)}
                                    />
                                ))}
                        </div>
                    )}
                </div>
            </div>

            <CommandPalette
                isOpen={isPaletteOpen}
                onClose={closePalette}
                query={query}
                onQueryChange={setQuery}
                placeholder='Search courses by title, subject, id, or tag...'
            >
                {normalizedQuery ? (
                    <div className='h-full p-4 overflow-y-auto flex flex-col gap-2 bg-neutral6'>
                        {searchResults.length === 0 ? (
                            <p className='text-sm text-neutral1 p-4'>No courses found for “{normalizedQuery}”.</p>
                        ) : (
                            <>
                                {searchResults.map((course) => (
                                    <CourseSearchResultRow
                                        key={course.courseId}
                                        course={course}
                                        isTaking={selectedCourseIds.has(String(course.courseId))}
                                        loading={loadingCourseId === String(course.courseId)}
                                        onAdd={() => handleJoinCourse(course.courseId)}
                                    />
                                ))}
                            </>
                        )}
                    </div>
                ) : (
                    <div className='h-full flex min-h-0 bg-neutral6'>
                        <aside className='w-64 shrink-0 p-3 overflow-y-auto'>
                            <div className='flex flex-col gap-1'>
                                {subjects.map((subject) => (
                                    <button
                                        key={subject}
                                        onClick={() => setActiveSubject(subject)}
                                        className={`text-left rounded-xl px-3 py-2 text-sm transition-colors  cursor-pointer ${activeSubject === subject
                                            ? 'bg-neutral5 text-neutral0'
                                            : 'text-neutral1 hover:bg-neutral5 hover:text-neutral0'
                                            }`}
                                    >
                                        {subject}
                                    </button>
                                ))}
                            </div>
                        </aside>

                        <div className='flex-1 min-h-0 overflow-y-auto p-4'>
                            <h3 className='text-sm text-neutral1 mb-3'>{activeSubject || 'Courses'}</h3>
                            <div className='grid grid-cols-2 gap-3'>
                                {subjectCourses.map((course) => (
                                    <CoursePaletteGridCard
                                        key={course.courseId}
                                        course={course}
                                        isTaking={selectedCourseIds.has(String(course.courseId))}
                                        loading={loadingCourseId === String(course.courseId)}
                                        onAdd={() => handleJoinCourse(course.courseId)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </CommandPalette>

            <BottomFade />
        </>
    )
}

export default MyCoursesTab