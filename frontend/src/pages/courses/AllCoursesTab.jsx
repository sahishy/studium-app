import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaMagnifyingGlass } from 'react-icons/fa6'
import Button from '../../components/main/Button'
import CourseCommandPalette from '../../components/commandPalettes/CourseCommandPalette'
import AllCoursesCard from '../../components/courses/AllCoursesCard'
import { getAllCourses, getCourseSubjects, searchCourses } from '../../services/courseService'
import { getAverageScoreByCourseIds } from '../../services/reviewService'
import { createCacheKey, resolveCachedRecordsByIds, setCachedRecordsById } from '../../services/cacheService'
import { CACHE_NAMESPACES, CACHE_TTLS_MS } from '../../utils/cacheUtils'

const CARD_PAGE_SIZE = 9
const PALETTE_PAGE_SIZE = 10
const SCORE_CACHE_TTL_MS = CACHE_TTLS_MS.COURSE_SCORE
const SCORE_CACHE_NAMESPACE = CACHE_NAMESPACES.COURSE_SCORE

const getScoreCacheKey = (courseId) => {
    return createCacheKey(SCORE_CACHE_NAMESPACE, courseId)
}

const AllCoursesTab = () => {
    const navigate = useNavigate()
    const [visibleCount, setVisibleCount] = useState(CARD_PAGE_SIZE)
    const [isPaletteOpen, setIsPaletteOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [searchVisibleCount, setSearchVisibleCount] = useState(PALETTE_PAGE_SIZE)
    const [subjectVisibleCount, setSubjectVisibleCount] = useState(PALETTE_PAGE_SIZE)
    const [scoreMap, setScoreMap] = useState({})
    const [loadingScoreIds, setLoadingScoreIds] = useState({})
    const subjects = useMemo(() => getCourseSubjects(), [])
    const [activeSubject, setActiveSubject] = useState(subjects[0] ?? null)

    const allCourses = useMemo(() => {
        return getAllCourses().slice().sort((a, b) => a.title.localeCompare(b.title))
    }, [])

    const normalizedQuery = query.trim()

    const visibleCourses = useMemo(() => {
        return allCourses.slice(0, visibleCount)
    }, [allCourses, visibleCount])

    const searchResults = useMemo(() => {
        if(!normalizedQuery) {
            return []
        }

        return searchCourses(normalizedQuery, { excludeCourseIds: [] })
    }, [normalizedQuery])

    const subjectCourses = useMemo(() => {
        if(normalizedQuery) {
            return []
        }

        return searchCourses('', {
            subject: activeSubject,
            excludeCourseIds: []
        })
    }, [normalizedQuery, activeSubject])

    const visibleSearchResults = useMemo(() => {
        return searchResults.slice(0, searchVisibleCount)
    }, [searchResults, searchVisibleCount])

    const visibleSubjectCourses = useMemo(() => {
        return subjectCourses.slice(0, subjectVisibleCount)
    }, [subjectCourses, subjectVisibleCount])

    const canLoadMoreCards = allCourses.length > visibleCourses.length
    const canLoadMoreSearch = searchResults.length > visibleSearchResults.length
    const canLoadMoreSubject = subjectCourses.length > visibleSubjectCourses.length

    useEffect(() => {
        let cancelled = false

        const visibleIds = Array.from(new Set([
            ...visibleCourses.map((course) => String(course.courseId)),
            ...visibleSearchResults.map((course) => String(course.courseId)),
            ...visibleSubjectCourses.map((course) => String(course.courseId))
        ].filter(Boolean)))

        if(visibleIds.length === 0) {
            return
        }

        const {
            freshValuesById,
            staleValuesById,
            missingIds,
            staleIds,
        } = resolveCachedRecordsByIds(visibleIds, {
            keyForId: getScoreCacheKey,
        })

        setScoreMap((previous) => ({
            ...previous,
            ...freshValuesById,
            ...staleValuesById,
        }))

        const loadMissingScores = async () => {
            if(missingIds.length === 0) {
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

                if(!cancelled) {
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
            if(staleIds.length === 0) {
                return
            }

            const nextMap = await getAverageScoreByCourseIds(staleIds)
            const normalizedMap = staleIds.reduce((acc, courseId) => {
                acc[String(courseId)] = nextMap[String(courseId)] ?? null
                return acc
            }, {})

            if(!cancelled) {
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
    }, [visibleCourses, visibleSearchResults, visibleSubjectCourses])

    useEffect(() => {
        setSearchVisibleCount(PALETTE_PAGE_SIZE)
    }, [normalizedQuery])

    useEffect(() => {
        setSubjectVisibleCount(PALETTE_PAGE_SIZE)
    }, [activeSubject])

    const openPalette = () => {
        setQuery('')
        setSearchVisibleCount(PALETTE_PAGE_SIZE)
        setSubjectVisibleCount(PALETTE_PAGE_SIZE)
        setIsPaletteOpen(true)
    }

    const closePalette = () => setIsPaletteOpen(false)

    const openCourse = (courseId) => {
        navigate(`/courses/all/${courseId}`)
    }

    return (
        <>
            <div className='w-full h-full flex flex-col gap-4 lg:flex-row lg:gap-16 lg:items-start m-auto'>
                <div className='flex-1 flex flex-col items-start pb-16'>
                    <div className='w-full flex justify-center py-8'>
                        <button
                            onClick={openPalette}
                            className='px-6 py-3 bg-neutral5 rounded-full text-neutral1 hover:bg-neutral4 cursor-pointer
                                flex gap-3 items-center w-96 hover:w-104 transition-all'
                        >
                            <FaMagnifyingGlass className='text-neutral0'/>
                            Search courses...
                        </button>
                    </div>

                    <div className='w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
                        {visibleCourses.map((course) => (
                            <AllCoursesCard
                                key={course.courseId}
                                course={course}
                                score={scoreMap[course.courseId]}
                                onOpen={() => openCourse(course.courseId)}
                            />
                        ))}
                    </div>

                    {canLoadMoreCards ? (
                        <div className='w-full flex justify-center pt-6'>
                            <Button type='secondary' onClick={() => setVisibleCount((prev) => prev + CARD_PAGE_SIZE)}>
                                Load More
                            </Button>
                        </div>
                    ) : null}

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
                onLoadMoreSearch={() => setSearchVisibleCount((prev) => prev + PALETTE_PAGE_SIZE)}
                onLoadMoreSubject={() => setSubjectVisibleCount((prev) => prev + PALETTE_PAGE_SIZE)}
                scoreMap={scoreMap}
                getScoreLoading={(courseId) => Boolean(loadingScoreIds[String(courseId)])}
                getIsTaking={() => false}
                getIsLoading={() => false}
                onSelectCourse={(course) => {
                    closePalette()
                    openCourse(course.courseId)
                }}
            />
        </>
    )
}

export default AllCoursesTab