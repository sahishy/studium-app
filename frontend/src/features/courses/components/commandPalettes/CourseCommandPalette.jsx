import BaseCommandPalette from '../../../../shared/components/commandPalettes/BaseCommandPalette'
import Button from '../../../../shared/components/ui/Button'
import CourseSearchResultRow from '../CourseSearchResultRow'
import CoursePaletteGridCard from '../CoursePaletteGridCard'

const CourseCommandPalette = ({
    isOpen,
    onClose,
    query,
    onQueryChange,
    searchResults = [],
    visibleSearchResults = [],
    subjects = [],
    activeSubject = null,
    onSubjectChange,
    visibleSubjectCourses = [],
    canLoadMoreSearch = false,
    canLoadMoreSubject = false,
    onLoadMoreSearch,
    onLoadMoreSubject,
    scoreMap = {},
    getScoreLoading = () => false,
    getIsTaking = () => false,
    getIsLoading = () => false,
    onSelectCourse,
}) => {
    const normalizedQuery = query.trim()

    return (
        <BaseCommandPalette
            isOpen={isOpen}
            onClose={onClose}
            query={query}
            onQueryChange={onQueryChange}
            placeholder='Search courses by title, subject, id, or tag...'
        >
            {normalizedQuery ? (
                <div className='h-full px-4 pb-4 overflow-y-auto flex flex-col gap-2 bg-neutral6'>
                    {searchResults.length === 0 ? (
                        <p className='text-sm text-neutral1 p-4'>No courses found for "{normalizedQuery}".</p>
                    ) : (
                        <>
                            {visibleSearchResults.map((course) => (
                                <CourseSearchResultRow
                                    key={course.courseId}
                                    course={course}
                                    score={scoreMap[String(course.courseId)]}
                                    scoreLoading={getScoreLoading(String(course.courseId))}
                                    isTaking={getIsTaking(String(course.courseId))}
                                    loading={getIsLoading(String(course.courseId))}
                                    onAdd={() => onSelectCourse?.(course)}
                                />
                            ))}

                            {canLoadMoreSearch ? (
                                <div className='w-full flex justify-center pt-2'>
                                    <Button type='secondary' onClick={onLoadMoreSearch}>
                                        Load More
                                    </Button>
                                </div>
                            ) : null}
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
                                    onClick={() => onSubjectChange?.(subject)}
                                    className={`text-left rounded-xl px-3 py-2 text-sm transition-colors cursor-pointer ${activeSubject === subject
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
                            {visibleSubjectCourses.map((course) => (
                                <CoursePaletteGridCard
                                    key={course.courseId}
                                    course={course}
                                    score={scoreMap[String(course.courseId)]}
                                    isTaking={getIsTaking(String(course.courseId))}
                                    loading={getIsLoading(String(course.courseId))}
                                    onAdd={() => onSelectCourse?.(course)}
                                />
                            ))}
                        </div>

                        {canLoadMoreSubject ? (
                            <div className='w-full flex justify-center pt-4'>
                                <Button type='secondary' onClick={onLoadMoreSubject}>
                                    Load More
                                </Button>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </BaseCommandPalette>
    )
}

export default CourseCommandPalette