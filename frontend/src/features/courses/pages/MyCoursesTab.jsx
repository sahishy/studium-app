import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import MyCoursesCard from '../components/MyCoursesCard'
import CourseCommandPalette from '../components/commandPalettes/CourseCommandPalette'
import { useCourses } from '../contexts/CoursesContext'
import { getCourseSubjects, leaveCourse, searchCourses } from '../services/courseService'
import { FaArrowUp, FaMagnifyingGlass } from 'react-icons/fa6'
import { useModal } from '../../../shared/contexts/ModalContext'
import AddCourseModal from '../components/modals/AddCourseModal'
import { useUserStats } from '../../profile/contexts/UserStatsContext'
import { getAverageScoreByCourseIds } from '../services/reviewService'
import { getTeachersByIdsMap } from '../services/teacherService'
import LoadingState from '../../../shared/components/ui/LoadingState'
import { createCacheKey, resolveCachedRecordsByIds, setCachedRecordsById } from '../../../shared/services/cacheService'
import { CACHE_NAMESPACES, CACHE_TTLS_MS } from '../../../shared/utils/cacheUtils'
import study0 from '../../../assets/images/illustrations/study0.png'

const RESULTS_PAGE_SIZE = 10
const SCORE_CACHE_TTL_MS = CACHE_TTLS_MS.COURSE_SCORE
const SCORE_CACHE_NAMESPACE = CACHE_NAMESPACES.COURSE_SCORE

const getScoreCacheKey = (courseId) => {
    return createCacheKey(SCORE_CACHE_NAMESPACE, courseId)
}

const MyCoursesTab = () => {

    const { profile } = useOutletContext()
    const { userStats } = useUserStats()
    const { openModal, closeModal } = useModal()
    const { enrollments = [], selectedCourses = [], courseIds = [], loading: coursesLoading = false } = useCourses()
    const [loadingCourseId, setLoadingCourseId] = useState(null)
    const [teachersLoading, setTeachersLoading] = useState(false)
    const [isPaletteOpen, setIsPaletteOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [searchVisibleCount, setSearchVisibleCount] = useState(RESULTS_PAGE_SIZE)
    const [subjectVisibleCount, setSubjectVisibleCount] = useState(RESULTS_PAGE_SIZE)
    const [scoreMap, setScoreMap] = useState({})
    const [loadingScoreIds, setLoadingScoreIds] = useState({})
    const [teachersMap, setTeachersMap] = useState({})

    const subjects = useMemo(() => getCourseSubjects(), [])
    const [activeSubject, setActiveSubject] = useState(subjects[0] ?? null)

    const normalizedQuery = query.trim()

    const selectedCourseIds = useMemo(() => {
        return new Set(courseIds.map((courseId) => String(courseId)))
    }, [courseIds])

    const enrollmentByCourseId = useMemo(() => {
        return enrollments.reduce((acc, enrollment) => {
            acc[String(enrollment.courseId)] = enrollment
            return acc
        }, {})
    }, [enrollments])

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
    const isScoreLoading = Object.keys(loadingScoreIds).length > 0
    const isPageLoading = coursesLoading || teachersLoading || Boolean(loadingCourseId)
    const isPaletteLoading = isScoreLoading || coursesLoading || Boolean(loadingCourseId)

    useEffect(() => {
        let cancelled = false

        const visibleCourseIds = normalizedQuery
            ? visibleSearchResults.map((course) => String(course.courseId))
            : visibleSubjectCourses.map((course) => String(course.courseId))

        if (visibleCourseIds.length === 0) {
            return
        }

        const {
            freshValuesById,
            staleValuesById,
            missingIds,
            staleIds,
        } = resolveCachedRecordsByIds(visibleCourseIds, {
            keyForId: getScoreCacheKey,
        })

        setScoreMap((previous) => ({
            ...previous,
            ...freshValuesById,
            ...staleValuesById,
        }))

        const loadMissingScores = async () => {
            if (missingIds.length === 0) {
                return
            }

            setLoadingScoreIds((previous) => {
                const next = { ...previous }
                missingIds.forEach((courseId) => {
                    next[String(courseId)] = true
                })
                return next
            })

            try {
                const nextMap = await getAverageScoreByCourseIds(missingIds)
                const normalizedMap = missingIds.reduce((acc, courseId) => {
                    acc[String(courseId)] = nextMap[String(courseId)] ?? null
                    return acc
                }, {})

                if (!cancelled) {
                    setCachedRecordsById(normalizedMap, {
                        keyForId: getScoreCacheKey,
                        ttlMs: SCORE_CACHE_TTL_MS,
                    })
                    setScoreMap((previous) => ({
                        ...previous,
                        ...normalizedMap,
                    }))
                }
            } finally {
                setLoadingScoreIds((previous) => {
                    const next = { ...previous }
                    missingIds.forEach((courseId) => {
                        delete next[String(courseId)]
                    })
                    return next
                })
            }
        }

        const refreshStaleScores = async () => {
            if (staleIds.length === 0) {
                return
            }

            const nextMap = await getAverageScoreByCourseIds(staleIds)
            const normalizedMap = staleIds.reduce((acc, courseId) => {
                acc[String(courseId)] = nextMap[String(courseId)] ?? null
                return acc
            }, {})

            if (!cancelled) {
                setCachedRecordsById(normalizedMap, {
                    keyForId: getScoreCacheKey,
                    ttlMs: SCORE_CACHE_TTL_MS,
                })
                setScoreMap((previous) => ({
                    ...previous,
                    ...normalizedMap,
                }))
            }
        }

        loadMissingScores()
        refreshStaleScores()

        return () => {
            cancelled = true
        }
    }, [normalizedQuery, visibleSearchResults, visibleSubjectCourses])

    useEffect(() => {
        let cancelled = false

        const teacherIds = Array.from(
            new Set(
                enrollments
                    .map((enrollment) => String(enrollment.teacherId ?? ''))
                    .filter(Boolean)
            )
        )

        if (teacherIds.length === 0) {
            if (!cancelled) {
                setTeachersMap({})
                setTeachersLoading(false)
            }
            return
        }

        const loadTeachers = async () => {
            setTeachersLoading(true)
            try {
                const nextMap = await getTeachersByIdsMap(teacherIds)
                if (!cancelled) {
                    setTeachersMap(nextMap)
                }
            } finally {
                if (!cancelled) {
                    setTeachersLoading(false)
                }
            }
        }

        loadTeachers()

        return () => {
            cancelled = true
        }
    }, [enrollments])

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
                schoolId={userStats?.academic?.schoolId ?? null}
                schoolAffiliations={userStats?.academic?.schoolAffiliations ?? []}
                closeModal={closeModal}
            />
        )
    }

    return (
        <>
            <div className='w-full h-full flex flex-col gap-4 lg:flex-row lg:gap-16 lg:items-start m-auto'>

                <div className='flex-1 flex flex-col items-start pb-16'>

                    <div className='w-full flex justify-center py-8'>
                        {/* <Button type='secondary' onClick={openPalette}>Add Course</Button> */}
                        <button
                            onClick={openPalette}
                            className='px-6 py-3 text-sm bg-neutral5 rounded-full text-neutral1 hover:bg-neutral4 cursor-pointer
                                flex gap-3 items-center w-96 hover:w-104 transition-all'
                        >
                            <FaMagnifyingGlass className='text-neutral0' />
                            Add a course...
                        </button>
                    </div>

                    {isPageLoading ? (
                        <LoadingState/>
                    ) : selectedCourses.length === 0 ? (
                        <div className='w-full flex flex-col items-center justify-center py-16 gap-1'>
                            <img src={study0} alt='Studying' className='object-contain w-96' />
                            <h1 className='text-3xl font-bold'>No courses</h1>
                            <p className='text-sm text-neutral1'>You haven't added any courses yet. Add the courses you're taking!</p>
                        </div>
                    ) : (
                        <div className='w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
                            {selectedCourses
                                .slice()
                                .sort((a, b) => a.title.localeCompare(b.title))
                                .map((course) => {
                                    const enrollment = enrollmentByCourseId[String(course.courseId)]

                                    return (
                                        <MyCoursesCard
                                            key={course.courseId}
                                            course={course}
                                            customization={enrollment?.customization}
                                            teacherName={teachersMap[String(enrollment?.teacherId)]?.name}
                                            loading={loadingCourseId === String(course.courseId)}
                                            onRemove={() => handleLeaveCourse(course.courseId)}
                                        />
                                    )
                                })}
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
                getScoreLoading={() => false}
                getIsTaking={(courseId) => selectedCourseIds.has(String(courseId))}
                getIsLoading={() => isPaletteLoading}
                onSelectCourse={handleOpenAddCourseModal}
            />
        </>
    )
}

export default MyCoursesTab