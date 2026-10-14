import { useState } from 'react'
import Button from '../../../../shared/components/ui/Button'
import { joinCourse } from '../../services/courseService'
import { COURSE_COLORS } from '../../utils/courseUtils'
const AddCourseModal = ({ profile, course, closeModal, onAdded = () => {} }) => {
    const [color, setColor] = useState(COURSE_COLORS[0])
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const submit = async e => {
        e.preventDefault(); setBusy(true); setError('')
        try { await joinCourse(profile.uid, course.courseId, { customization: { color } }); onAdded(); closeModal() }
        catch (err) { setError(err.message) } finally { setBusy(false) }
    }
    return <form onSubmit={submit} className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Add Course</h1><p>{course.title}</p>
        <p className="text-sm text-neutral1">Choose a color</p>
        <div className="flex gap-2 flex-wrap">{COURSE_COLORS.map(c => <button type="button" key={c} aria-label={`Select ${c}`} aria-pressed={c === color} onClick={() => setColor(c)} style={{backgroundColor:c}} className={`size-9 rounded-full ${c === color ? 'ring-2 ring-neutral0 ring-offset-2' : ''}`} />)}</div>
        {error && <p role="alert">{error}</p>}
        <div className="flex gap-3"><Button onClick={closeModal} disabled={busy}>Cancel</Button><Button htmlType="submit" type="primary" disabled={busy}>{busy ? 'Adding…' : 'Add Course'}</Button></div>
    </form>
}
export default AddCourseModal
