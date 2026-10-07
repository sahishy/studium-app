import { useEffect, useState } from 'react'
import { FaCalendar, FaList, FaTh } from 'react-icons/fa'
import Button from '../../../shared/components/ui/Button'
import { LIST_GROUP_OPTIONS } from '../utils/taskListUtils'

const Choice = ({ label, options, value, onChange }) => (
    <div><p className='mb-2 text-xs font-semibold uppercase tracking-wide text-neutral1'>{label}</p>
        <div className='flex flex-wrap gap-2' role='radiogroup' aria-label={label}>{options.map((option) => <button key={option.id} type='button' role='radio' aria-checked={value === option.id} onClick={() => onChange(option.id)} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${value === option.id ? 'border-neutral0 bg-neutral0 text-neutral6' : 'border-neutral4 hover:bg-neutral5'}`}>{option.label}</button>)}</div>
    </div>
)

const ViewPreferencesModal = ({ preferences, onSave, closeModal }) => {
    const [draft, setDraft] = useState(preferences)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')
    useEffect(() => setDraft(preferences), [preferences])
    const setOption = (section, key, value) => setDraft((current) => ({ ...current, [section]: { ...current[section], [key]: value } }))
    const handleSave = async () => {
        setIsSaving(true)
        setError('')
        try { await onSave(draft); closeModal() }
        catch { setError('Could not save your options. Please try again.') }
        finally { setIsSaving(false) }
    }
    return <div className='flex max-h-[80vh] flex-col gap-5 overflow-y-auto'>
        <div><h1 className='text-2xl font-semibold'>Options</h1><p className='mt-1 text-sm text-neutral1'>Choose how tasks appear in each view.</p></div>
        <section className='space-y-4 rounded-xl border border-neutral4 p-4'><h2 className='flex items-center gap-2 font-semibold'><FaList className='text-neutral1' />List</h2>
            <Choice label='Group by' options={LIST_GROUP_OPTIONS} value={draft.list.groupBy} onChange={(value) => setOption('list', 'groupBy', value)} />
            <Choice label='Layout' options={[{ id: 'smart', label: 'Smart list' }, { id: 'table', label: 'Table' }]} value={draft.list.layout} onChange={(value) => setOption('list', 'layout', value)} />
            <Choice label='On completion' options={[{ id: 'keep', label: 'Keep checked' }, { id: 'delete', label: 'Delete permanently' }]} value={draft.list.completionBehavior} onChange={(value) => setOption('list', 'completionBehavior', value)} />
            <p className='text-xs text-neutral1'>Completed subtasks stay visible until their parent is complete.</p>
        </section>
        <section className='space-y-4 rounded-xl border border-neutral4 p-4'><h2 className='flex items-center gap-2 font-semibold'><FaTh className='text-neutral1' />Board</h2>
            <Choice label='Columns' options={[{ id: 'status', label: 'Status' }, { id: 'course', label: 'Course' }, { id: 'dueDate', label: 'Date' }]} value={draft.board.groupBy} onChange={(value) => setOption('board', 'groupBy', value)} />
        </section>
        <section className='space-y-4 rounded-xl border border-neutral4 p-4'><h2 className='flex items-center gap-2 font-semibold'><FaCalendar className='text-neutral1' />Calendar</h2>
            <Choice label='Sort within day' options={[{ id: 'status', label: 'Status' }, { id: 'course', label: 'Course' }, { id: 'title', label: 'Title' }]} value={draft.calendar.sortBy} onChange={(value) => setOption('calendar', 'sortBy', value)} />
        </section>
        {error && <p role='alert' className='text-sm text-red-500'>{error}</p>}
        <div className='flex justify-end gap-2'><Button onClick={closeModal} disabled={isSaving}>Cancel</Button><Button type='primary' onClick={handleSave} disabled={isSaving}>Save</Button></div>
    </div>
}
export default ViewPreferencesModal
