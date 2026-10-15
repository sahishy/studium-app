import { useState } from 'react'
import Button from '../../../shared/components/ui/Button'
import TextField from '../../../shared/components/ui/TextField'

const EditLessonModal = ({ lesson, onSave, closeModal }) => {

    const [draft, setDraft] = useState({ title: lesson.title || '', subject: lesson.subject || '', description: lesson.description || '' })

    const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }))

    return (
        <div className='flex flex-col gap-6 w-full max-w-md'>

            <div className='flex flex-col gap-1'>
                <h2 className='text-xl font-semibold text-neutral0'>Lesson details</h2>
                <p className='text-sm text-neutral1'>How this lesson shows up for everyone else.</p>
            </div>

            <div className='flex flex-col gap-4'>
                <TextField label='Lesson name' value={draft.title} onChange={(value) => set('title', value)} maxLength={120} autoFocus />
                <TextField label='Subject' value={draft.subject} onChange={(value) => set('subject', value)} placeholder='Optional' maxLength={80} />
                <TextField label='Description' value={draft.description} onChange={(value) => set('description', value)} placeholder='Optional' rows={3} maxLength={1200} />
            </div>

            <div className='flex gap-3 mt-2'>
                <Button onClick={closeModal} className='w-full py-4'>Cancel</Button>
                <Button type='primary' onClick={() => { onSave(draft); closeModal() }} className='w-full py-4' disabled={!draft.title.trim()}>Save</Button>
            </div>

        </div>
    )
}

export default EditLessonModal
