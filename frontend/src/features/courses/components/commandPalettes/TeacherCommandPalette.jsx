import BaseCommandPalette from '../../../../shared/components/commandPalettes/BaseCommandPalette'
import Button from '../../../../shared/components/ui/Button'
import { toTitleCase } from '../../../../shared/utils/formatters'
import { getSchoolNameById } from '../../../profile/services/schoolService'
import Card from '../../../../shared/components/ui/Card'

const TeacherCommandPalette = ({
    isOpen,
    onClose,
    query,
    onQueryChange,
    teacherResults = [],
    teacherLoading = false,
    teacherHasMore = false,
    onLoadMore,
    onSelectTeacher,
    onCreateTeacher,
    createLoading = false,
}) => {
    const normalizedQuery = query.trim()

    return (
        <BaseCommandPalette
            isOpen={isOpen}
            onClose={onClose}
            query={query}
            onQueryChange={onQueryChange}
            placeholder='Search for teacher...'
            footer={teacherHasMore ? (
                <div className='w-full flex justify-center'>
                    <Button type='secondary' onClick={onLoadMore} disabled={teacherLoading}>
                        Load More
                    </Button>
                </div>
            ) : null}
        >
            <div className='h-full overflow-y-auto p-4 flex flex-col gap-2 bg-neutral6'>
                {teacherResults.map((teacher) => (
                    <button
                        key={teacher.uid}
                        onClick={() => onSelectTeacher?.(teacher)}
                        className='w-full'
                    >
                        <Card hoverable={true} className={'flex flex-col items-start gap-1!'}>
                            <p className='text-sm text-neutral0 font-semibold'>{teacher.name}</p>
                            <p className='text-xs text-neutral1'>
                                {teacher.schoolId ? (getSchoolNameById(teacher.schoolId) ?? 'No school') : 'No school'}
                            </p>
                        </Card>
                    </button>
                ))}

                {/* {teacherResults.length === 0 && !teacherLoading ? (
                    <p className='text-center text-sm text-neutral1 p-3'>No teachers found.</p>
                ) : null} */}

                {normalizedQuery ? (
                    <div className='p-2 flex items-center justify-center gap-3'>
                        <p className='text-sm text-neutral1'>Can't find your teacher?</p>
                        <Button type='secondary' className='disabled:opacity-100!' onClick={onCreateTeacher} disabled={createLoading || teacherLoading}>
                            {createLoading ? 'Adding...' : `Add "${toTitleCase(normalizedQuery)}"`}
                        </Button>
                    </div>
                ) : null}
            </div>
        </BaseCommandPalette>
    )
}

export default TeacherCommandPalette