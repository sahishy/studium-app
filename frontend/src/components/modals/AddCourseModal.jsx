import { useEffect, useMemo, useState } from 'react'
import Button from '../main/Button'
import BooleanSelect from '../main/BooleanSelect'
import TeacherCommandPalette from '../commandPalettes/TeacherCommandPalette'
import { createTeacher, searchTeachersByName } from '../../services/teacherService'
import { joinCourse } from '../../services/courseService'
import { toTitleCase } from '../../utils/formatters'

const AddCourseModal = ({ profile, course, schoolId = null, closeModal, onAdded = () => { } }) => {

    const [day, setDay] = useState('A')
    const [selectedTeacher, setSelectedTeacher] = useState(null)
    const [isSaving, setIsSaving] = useState(false)

    const [teacherPaletteOpen, setTeacherPaletteOpen] = useState(false)
    const [teacherQuery, setTeacherQuery] = useState('')
    const [teacherResults, setTeacherResults] = useState([])
    const [teacherCursor, setTeacherCursor] = useState(null)
    const [teacherHasMore, setTeacherHasMore] = useState(false)
    const [teacherLoading, setTeacherLoading] = useState(false)
    const [createLoading, setCreateLoading] = useState(false)

    const normalizedTeacherQuery = teacherQuery.trim()

    const loadTeachers = async ({ reset = false } = {}) => {
        setTeacherLoading(true)
        try {

            const response = await searchTeachersByName({
                queryText: normalizedTeacherQuery,
                schoolId,
                limitCount: 12,
                cursor: reset ? null : teacherCursor,
            })

            setTeacherResults((prev) => {
                if(reset) {
                    return response.teachers
                }

                const merged = [...prev]
                const seen = new Set(prev.map((teacher) => teacher.uid))
                response.teachers.forEach((teacher) => {
                    if(!seen.has(teacher.uid)) {
                        merged.push(teacher)
                        seen.add(teacher.uid)
                    }
                })
                return merged
            })
            setTeacherCursor(response.nextCursor)
            setTeacherHasMore(response.hasMore)
        } finally {
            setTeacherLoading(false)
        }
    }

    useEffect(() => {
        if (!teacherPaletteOpen) {
            return
        }

        setTeacherCursor(null)
        loadTeachers({ reset: true })

    }, [normalizedTeacherQuery, teacherPaletteOpen])

    const handleCreateTeacher = async () => {
        if (!normalizedTeacherQuery || !profile?.uid) {
            return
        }

        setCreateLoading(true)
        try {
            const teacherId = await createTeacher({
                name: toTitleCase(normalizedTeacherQuery),
                schoolId,
                createdBy: profile.uid,
            })

            setSelectedTeacher({ uid: teacherId, name: toTitleCase(normalizedTeacherQuery), schoolId })
            setTeacherPaletteOpen(false)
        } finally {
            setCreateLoading(false)
        }
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        if (!profile?.uid || !course?.courseId || !selectedTeacher?.uid) {
            return
        }

        setIsSaving(true)
        try {
            await joinCourse(profile.uid, course.courseId, {
                day,
                teacherId: selectedTeacher.uid,
                customization: {
                    bgColor: '#1f2937',
                    iconColor: '#ffffff',
                }
            })

            onAdded?.()
            closeModal?.()
        } finally {
            setIsSaving(false)
        }
    }

    const teacherButtonLabel = useMemo(() => {
        if (selectedTeacher?.name) {
            return selectedTeacher.name
        }

        return 'Select your teacher'
    }, [selectedTeacher])

    return (
        <>
            <div className='flex flex-col gap-6'>
                <h1 className='text-2xl font-semibold text-center'>Add Course</h1>

                <form onSubmit={handleSubmit} className='flex flex-col gap-4'>

                    <div className='flex flex-col gap-2 opacity-60'>
                        <p className='text-sm text-neutral1'>Course</p>
                        <div className='w-full px-4 py-3 rounded-xl border border-neutral4 text-left text-sm text-neutral1 cursor-not-allowed'>
                            {course?.title}
                        </div>
                    </div>

                    <div className='flex flex-col gap-2'>
                        <p className='text-sm text-neutral1'>Day</p>
                        <BooleanSelect
                            leftOption={{ value: 'A', label: 'A Day' }}
                            rightOption={{ value: 'B', label: 'B Day' }}
                            value={day}
                            onChange={setDay}
                        />
                    </div>

                    <div className='flex flex-col gap-2'>
                        <p className='text-sm text-neutral1'>Teacher</p>
                        <button
                            type='button'
                            onClick={() => setTeacherPaletteOpen(true)}
                            className='w-full px-4 py-3 rounded-xl border border-neutral4 text-left text-sm text-neutral1 hover:bg-neutral5 transition-colors cursor-pointer'
                        >
                            {teacherButtonLabel}
                        </button>
                    </div>

                    <div className='flex gap-3 mt-2'>
                        <Button onClick={closeModal} type='secondary' className='w-full py-3'>
                            Cancel
                        </Button>
                        <Button htmlType='submit' type='primary' className='w-full py-3' disabled={isSaving || !selectedTeacher?.uid}>
                            {isSaving ? 'Adding...' : 'Add Course'}
                        </Button>
                    </div>
                </form>
            </div>

            <TeacherCommandPalette
                isOpen={teacherPaletteOpen}
                onClose={() => setTeacherPaletteOpen(false)}
                query={teacherQuery}
                onQueryChange={setTeacherQuery}
                teacherResults={teacherResults}
                teacherLoading={teacherLoading}
                teacherHasMore={teacherHasMore}
                onLoadMore={() => loadTeachers({ reset: false })}
                onSelectTeacher={(teacher) => {
                    setSelectedTeacher(teacher)
                    setTeacherPaletteOpen(false)
                }}
                onCreateTeacher={handleCreateTeacher}
                createLoading={createLoading}
            />
        </>
    )
}

export default AddCourseModal