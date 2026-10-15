import { useId, useState } from 'react'
import Button from '../../../../shared/components/ui/Button'
import { joinCourse } from '../../services/courseService'
import { COURSE_COLORS } from '../../utils/courseUtils'
const AddCourseModal = ({ profile, course, closeModal, onAdded = () => {} }) => {
    const courseInputId = useId()
    const [color, setColor] = useState(COURSE_COLORS[0])
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const submit = async e => {
        e.preventDefault(); setBusy(true); setError('')
        try { await joinCourse(profile.uid, course.courseId, { customization: { color } }); onAdded(); closeModal() }
        catch (err) { setError(err.message) } finally { setBusy(false) }
    }
    return (
        <div className='flex flex-col gap-8'>
            <h1 className='text-center text-2xl font-semibold'>Add Course</h1>

            <form onSubmit={submit} className='flex flex-col gap-6'>
                <div className='flex flex-col gap-2'>
                    <label htmlFor={courseInputId} className='text-sm text-neutral2'>Course</label>
                    <input
                        id={courseInputId}
                        type='text'
                        value={course.title}
                        disabled
                        className='w-full rounded-xl border border-neutral4/60 bg-neutral6 p-4 text-sm text-neutral2 disabled:opacity-100'
                    />
                </div>

                <fieldset disabled={busy} className='min-w-0'>
                    <legend className='mb-3 text-sm text-neutral1'>Color</legend>
                    <div className='flex items-center justify-between gap-2'>
                        {COURSE_COLORS.map((option, index) => (
                            <button
                                type='button'
                                key={option}
                                aria-label={`Select color ${index + 1}`}
                                aria-pressed={option === color}
                                onClick={() => setColor(option)}
                                style={{ backgroundColor: option, '--swatch-color': option }}
                                className={`aspect-square w-full max-w-9 rounded-full border border-neutral4 transition-transform enabled:cursor-pointer enabled:hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral0 ${option === color ? 'ring-2 ring-[var(--swatch-color)] ring-offset-2 ring-offset-neutral6' : ''}`}
                            />
                        ))}
                    </div>
                </fieldset>

                {error && <p role='alert' className='text-sm text-red-400'>{error}</p>}

                <div className='mt-2 grid grid-cols-2 gap-3'>
                    <Button className='w-full py-4' onClick={closeModal} disabled={busy}>Cancel</Button>
                    <Button className='w-full py-4' htmlType='submit' type='primary' disabled={busy}>{busy ? 'Adding…' : 'Add Course'}</Button>
                </div>
            </form>
        </div>
    )
}
export default AddCourseModal
