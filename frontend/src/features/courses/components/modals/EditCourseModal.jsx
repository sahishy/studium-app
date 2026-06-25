import { useState } from 'react'
import Button from '../../../../shared/components/ui/Button'
import { joinCourse } from '../../services/courseService'
import { COURSE_COLORS } from '../../utils/courseUtils'

const EditCourseModal = ({ profile, course, enrollment, closeModal, onSaved = () => {} }) => {

    const [selectedColor, setSelectedColor] = useState(enrollment?.customization?.color ?? COURSE_COLORS[0])
    const [isSaving, setIsSaving] = useState(false)

    const handleSubmit = async (event) => {
        event.preventDefault()

        if(!profile?.uid || !course?.courseId || !enrollment) {
            return
        }

        setIsSaving(true)
        try {
            await joinCourse(profile.uid, course.courseId, {
                day: enrollment?.day === 'B' ? 'B' : 'A',
                teacherId: enrollment?.teacherId ?? null,
                customization: {
                    color: selectedColor ?? COURSE_COLORS[0],
                },
            })

            onSaved?.()
            closeModal?.()
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className='flex flex-col gap-6'>
            <h1 className='text-2xl font-semibold text-center'>Edit Course</h1>

            <form onSubmit={handleSubmit} className='flex flex-col gap-4'>

                <div className='flex flex-col gap-2'>
                    <p className='text-sm text-neutral1'>Color</p>
                    <div className='flex justify-between mb-3'>
                        {COURSE_COLORS.map((color, index) => {

                            const isSelected = selectedColor === color

                            return (
                                <button
                                    key={color}
                                    type='button'
                                    onClick={() => setSelectedColor(color)}
                                    className={`h-9 w-9 rounded-full border border-neutral4 cursor-pointer transition hover:scale-105 ${isSelected ? 'ring-2 ring-neutral0 ring-offset-2' : ''}`}
                                    style={{ backgroundColor: color }}
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
                    <Button htmlType='submit' type='primary' className='w-full py-3' disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>

            </form>
        </div>
    )
}

export default EditCourseModal
