import { useEffect, useMemo, useState } from 'react'
import Button from '../../../../shared/components/ui/Button'
import BooleanSelect from '../../../../shared/components/ui/BooleanSelect'
import TeacherCommandPalette from '../commandPalettes/TeacherCommandPalette'
import AddTeacherConfirmationModal from './AddTeacherConfirmationModal'
import AddTeacherErrorModal from './AddTeacherErrorModal'
import { createTeacher, searchTeachersBySchoolIds } from '../../services/teacherService'
import { joinCourse } from '../../services/courseService'
import { toTitleCase } from '../../../../shared/utils/formatters'
import { COURSE_COLORS } from '../../utils/courseUtils'
import { getEffectiveSchoolIds, getSchoolNameById } from '../../../profile/services/schoolService'
import { useModal } from '../../../../shared/contexts/ModalContext'

const AddCourseModal = ({
    profile,
    course,
    schoolId = null,
    schoolAffiliations = [],
    closeModal,
    onAdded = () => { }
}) => {

    const [day, setDay] = useState('A')
    const [selectedTeacher, setSelectedTeacher] = useState(null)
    const [selectedColor, setSelectedColor] = useState(COURSE_COLORS[0])
    const [isSaving, setIsSaving] = useState(false)

    const [teacherPaletteOpen, setTeacherPaletteOpen] = useState(false)
    const [teacherQuery, setTeacherQuery] = useState('')
    const [teacherResults, setTeacherResults] = useState([])
    const [teacherCursor, setTeacherCursor] = useState(null)
    const [teacherHasMore, setTeacherHasMore] = useState(false)
    const [teacherLoading, setTeacherLoading] = useState(false)
    const [createLoading, setCreateLoading] = useState(false)
    const { openModal, closeModal: closeTopModal } = useModal()

    const normalizedTeacherQuery = teacherQuery.trim()
    const effectiveSchoolIds = useMemo(() => {
        return getEffectiveSchoolIds({ schoolId, schoolAffiliations })
    }, [schoolId, schoolAffiliations])

    const teacherSchoolOptions = useMemo(() => {
        const combinedSchoolIds = [schoolId, ...(schoolAffiliations ?? [])]
        const normalizedSchoolIds = Array.from(new Set(combinedSchoolIds.map((id) => String(id)).filter(Boolean)))

        return normalizedSchoolIds.map((id) => ({
            id,
            label: getSchoolNameById(id) ?? `School ${id}`,
        }))
    }, [schoolId, schoolAffiliations])

    const createTeacherForSchool = async ({ teacherName, selectedSchoolId }) => {
        const teacherId = await createTeacher({
            name: teacherName,
            schoolId: selectedSchoolId,
            createdBy: profile.uid,
        })

        setSelectedTeacher({ uid: teacherId, name: teacherName, schoolId: selectedSchoolId })
    }

    const loadTeachers = async ({ reset = false } = {}) => {
        setTeacherLoading(true)
        try {

            const response = await searchTeachersBySchoolIds({
                queryText: normalizedTeacherQuery,
                schoolIds: effectiveSchoolIds,
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

    }, [normalizedTeacherQuery, teacherPaletteOpen, effectiveSchoolIds])

    const handleCreateTeacher = async () => {
        if (!normalizedTeacherQuery || !profile?.uid) {
            return
        }

        const teacherName = toTitleCase(normalizedTeacherQuery)
        const defaultSchoolId = effectiveSchoolIds.includes(String(schoolId))
            ? String(schoolId)
            : effectiveSchoolIds[0] ?? null

        if((schoolAffiliations ?? []).length > 0) {
            openModal(
                <AddTeacherConfirmationModal
                    teacherName={teacherName}
                    schoolOptions={teacherSchoolOptions}
                    defaultSchoolId={defaultSchoolId}
                    onCancel={closeTopModal}
                    onConfirm={(selectedSchoolId) => handleConfirmCreateTeacher(teacherName, selectedSchoolId)}
                    confirmLoading={createLoading}
                />
            )
            return
        }

        setCreateLoading(true)
        try {
            await createTeacherForSchool({ teacherName, selectedSchoolId: defaultSchoolId })
            setTeacherPaletteOpen(false)
        } finally {
            setCreateLoading(false)
        }
    }

    const handleConfirmCreateTeacher = async (teacherName, selectedSchoolId) => {
        if(!teacherName || !profile?.uid || !selectedSchoolId) {
            return
        }

        setCreateLoading(true)
        try {
            await createTeacherForSchool({ teacherName, selectedSchoolId })
            closeTopModal()
            setTeacherPaletteOpen(false)
        } finally {
            setCreateLoading(false)
        }
    }

    const handleCreateTeacherValidationError = (errorMessage) => {
        openModal(
            <AddTeacherErrorModal
                errorMessage={errorMessage}
                onClose={closeTopModal}
            />
        )
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
                    bgColor: selectedColor?.bg ?? '#f3f4f6',
                    iconColor: selectedColor?.icon ?? '#9ca3af',
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

                    <div className='flex flex-col gap-2'>
                        <p className='text-sm text-neutral1'>Color</p>
                        <div className='flex justify-between'>
                            {COURSE_COLORS.map((color, index) => {
                                const isSelected = selectedColor?.icon === color.icon && selectedColor?.bg === color.bg

                                return (
                                    <button
                                        key={`${color.icon}-${color.bg}`}
                                        type='button'
                                        onClick={() => setSelectedColor(color)}
                                        className={`h-9 w-9 rounded-full border border-neutral4 cursor-pointer transition-transform hover:scale-105 ${isSelected ? 'ring-2 ring-neutral1 ring-offset-2' : ''}`}
                                        style={{ backgroundColor: color.icon }}
                                        aria-label={`Select color ${index + 1}`}
                                    />
                                )
                            })}
                        </div>
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
                onCreateTeacherValidationError={handleCreateTeacherValidationError}
                createLoading={createLoading}
            />
        </>
    )
}

export default AddCourseModal