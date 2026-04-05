import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import MyCoursesCard from '../../components/courses/MyCoursesCard'
import CourseCommandPalette from '../../components/commandPalettes/CourseCommandPalette'
import { useCourses } from '../../contexts/CoursesContext'
import { getCourseSubjects, leaveCourse, searchCourses } from '../../services/courseService'
import { FaArrowUp, FaMagnifyingGlass } from 'react-icons/fa6'
import { useModal } from '../../contexts/ModalContext'
import AddCourseModal from '../../components/modals/AddCourseModal'
import { useUserStats } from '../../contexts/UserStatsContext'
import { getAverageScoreByCourseIds } from '../../services/reviewService'

const RESULTS_PAGE_SIZE = 10

const MyCoursesTab = () => {

    const { profile } = useOutletContext()
    const { userStats } = useUserStats()
    const { openModal, closeModal } = useModal()
    const { selectedCourses = [], courseIds = [] } = useCourses()
    const [loadingCourseId, setLoadingCourseId] = useState(null)
    const [isPaletteOpen, setIsPaletteOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [searchVisibleCount, setSearchVisibleCount] = useState(RESULTS_PAGE_SIZE)
    const [subjectVisibleCount, setSubjectVisibleCount] = useState(RESULTS_PAGE_SIZE)
    const [scoreMap, setScoreMap] = useState({})

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
        setSearchVisibleCount(RESULTS_PAGE_SIZE)
        setSubjectVisibleCount(RESULTS_PAGE_SIZE)
        setIsPaletteOpen(true)
    }

    const closePalette = () => {
        setIsPaletteOpen(false)
    }

    const visibleSearchResults = useMemo(() => {
        return searchResults.slice(0, searchVisibleCount)
    }, [searchResults, searchVisibleCount])

    const visibleSubjectCourses = useMemo(() => {
        return subjectCourses.slice(0, subjectVisibleCount)
    }, [subjectCourses, subjectVisibleCount])

    const canLoadMoreSearch = searchResults.length > visibleSearchResults.length
    const canLoadMoreSubject = subjectCourses.length > visibleSubjectCourses.length

    useEffect(() => {
        const visibleCourseIds = normalizedQuery
            ? visibleSearchResults.map((course) => String(course.courseId))
            : visibleSubjectCourses.map((course) => String(course.courseId))

        if (visibleCourseIds.length === 0) {
            setScoreMap({})
            return
        }

        const loadScores = async () => {
            const nextMap = await getAverageScoreByCourseIds(visibleCourseIds)
            setScoreMap(nextMap)
        }

        loadScores()
    }, [normalizedQuery, visibleSearchResults, visibleSubjectCourses])

    useEffect(() => {
        setSearchVisibleCount(RESULTS_PAGE_SIZE)
    }, [normalizedQuery])

    useEffect(() => {
        setSubjectVisibleCount(RESULTS_PAGE_SIZE)
    }, [activeSubject])

    const handleOpenAddCourseModal = (course) => {
        closePalette()
        openModal(
            <AddCourseModal
                profile={profile}
                course={course}
                schoolId={userStats?.schoolId ?? null}
                closeModal={closeModal}
            />
        )
    }

    const handleLeaveCourse = async (courseId) => {

        if(!profile?.uid) {
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

                <div className='flex-1 flex flex-col items-start pb-16'>

                    <div className='w-full flex justify-center py-8'>
                        {/* <Button type='secondary' onClick={openPalette}>Add Course</Button> */}
                        <button
                            onClick={openPalette}
                            className='px-6 py-3 bg-neutral5 rounded-full text-neutral1 hover:bg-neutral4 cursor-pointer
                                flex gap-3 items-center w-96 hover:w-104 transition-all'
                        >
                            <FaMagnifyingGlass className='text-neutral0' />
                            Add a course...
                        </button>
                    </div>

                    {selectedCourses.length === 0 ? (
                        <div className='w-full flex flex-col items-center justify-center py-16 gap-3'>
                            <FaArrowUp className='text-neutral1'/>
                            <p className='text-sm text-neutral1'>You haven't added any courses yet.</p>
                        </div>
                    ) : (
                        <div className='w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
                            {selectedCourses
                                .slice()
                                .sort((a, b) => a.title.localeCompare(b.title))
                                .map((course) => (
                                    <MyCoursesCard
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

            <CourseCommandPalette
                isOpen={isPaletteOpen}
                onClose={closePalette}
                query={query}
                onQueryChange={setQuery}
                searchResults={searchResults}
                visibleSearchResults={visibleSearchResults}
                subjects={subjects}
                activeSubject={activeSubject}
                onSubjectChange={setActiveSubject}
                visibleSubjectCourses={visibleSubjectCourses}
                canLoadMoreSearch={canLoadMoreSearch}
                canLoadMoreSubject={canLoadMoreSubject}
                onLoadMoreSearch={() => setSearchVisibleCount((prev) => prev + RESULTS_PAGE_SIZE)}
                onLoadMoreSubject={() => setSubjectVisibleCount((prev) => prev + RESULTS_PAGE_SIZE)}
                scoreMap={scoreMap}
                getIsTaking={(courseId) => selectedCourseIds.has(String(courseId))}
                getIsLoading={(courseId) => loadingCourseId === String(courseId)}
                onSelectCourse={handleOpenAddCourseModal}
            />
        </>
    )
}

export default MyCoursesTab