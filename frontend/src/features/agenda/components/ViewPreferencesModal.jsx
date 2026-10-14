import { useId, useState } from 'react'
import Button from '../../../shared/components/ui/Button'
import TextTabSelector from '../../../shared/components/ui/TextTabSelector'
import { LIST_GROUP_OPTIONS } from '../utils/taskListUtils'
import { resolveAgendaPreferences } from '../utils/agendaPreferences'

const VIEWS = ['list', 'board', 'calendar']
const Choice = ({ label, description, options, value, onChange }) => {
    const name = useId()
    return <fieldset className='min-w-0 space-y-2.5'>
        <legend className='text-sm font-semibold'>{label}</legend>
        {description && <p className='text-xs leading-relaxed text-neutral1'>{description}</p>}
        <div className='flex flex-wrap gap-2'>{options.map((option) => <label key={option.id} className='cursor-pointer'>
            <input type='radio' name={name} value={option.id} checked={value === option.id} onChange={() => onChange(option.id)} className='peer sr-only' />
            <span className='block rounded-xl border border-neutral4 px-3 py-2 text-xs text-neutral1 transition-colors hover:bg-neutral5 peer-checked:border-neutral3 peer-checked:bg-neutral5 peer-checked:font-semibold peer-checked:text-neutral0 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2'>{option.label}</span>
        </label>)}</div>
    </fieldset>
}

const ViewPreferencesModal = ({ preferences, initialView = 'list', onSave, closeModal }) => {
    const [draft, setDraft] = useState(() => resolveAgendaPreferences({ preferences: { agenda: preferences } }))
    const [activeView, setActiveView] = useState(VIEWS.includes(initialView) ? initialView : 'list')
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')
    const id = useId()
    const tabs = VIEWS.map((name) => ({ name, label: name.charAt(0).toUpperCase() + name.slice(1), id: `${id}-${name}-tab`, panelId: `${id}-${name}-panel` }))
    const setOption = (section, key, value) => setDraft((current) => ({ ...current, [section]: { ...current[section], [key]: value } }))
    const handleSave = async () => {
        setIsSaving(true)
        setError('')
        try { await onSave(draft); closeModal() }
        catch { setError('Could not save your options. Please try again.') }
        finally { setIsSaving(false) }
    }
    return <div className='flex max-h-[70dvh] flex-col gap-5'>
        <div><h1 className='text-2xl font-semibold'>View options</h1><p className='mt-1 text-sm text-neutral1'>Make your agenda work for you.</p></div>
        <TextTabSelector tabs={tabs} tabListLabel='Agenda view options' currentIndex={VIEWS.indexOf(activeView)} onSelect={(tab) => setActiveView(tab.name)} disabled={isSaving} />
        <div className='min-h-0 overflow-y-auto'>
            {VIEWS.map((view) => <div key={view} role='tabpanel' id={`${id}-${view}-panel`} aria-labelledby={`${id}-${view}-tab`} hidden={activeView !== view} tabIndex={0}>
                <fieldset disabled={isSaving} className='min-w-0 space-y-5 py-1'>
                    {view === 'list' && <>
                        <Choice label='Group tasks' options={LIST_GROUP_OPTIONS} value={draft.list.groupBy} onChange={(value) => setOption('list', 'groupBy', value)} />
                        <Choice label='Layout' options={[{ id: 'smart', label: 'Smart list' }, { id: 'table', label: 'Table' }]} value={draft.list.layout} onChange={(value) => setOption('list', 'layout', value)} />
                        <Choice label='Completed tasks' options={[{ id: 'keep', label: 'Keep checked' }, { id: 'delete', label: 'Delete permanently' }]} value={draft.list.completionBehavior} onChange={(value) => setOption('list', 'completionBehavior', value)} />
                        <p className='text-xs leading-relaxed text-neutral1'>{draft.list.completionBehavior === 'delete' ? 'Completion permanently deletes the task once all its subtasks are complete. This applies in every view.' : 'Completed tasks stay in your agenda. Subtasks determine their parent’s status.'}</p>
                    </>}
                    {view === 'board' && <Choice label='Group columns' description='Arrange your board by progress, course, or due date.' options={[{ id: 'status', label: 'Status' }, { id: 'course', label: 'Course' }, { id: 'dueDate', label: 'Date' }]} value={draft.board.groupBy} onChange={(value) => setOption('board', 'groupBy', value)} />}
                    {view === 'calendar' && <Choice label='Sort tasks within a day' description='Choose which tasks appear first on each date.' options={[{ id: 'status', label: 'Status' }, { id: 'course', label: 'Course' }, { id: 'title', label: 'Title' }]} value={draft.calendar.sortBy} onChange={(value) => setOption('calendar', 'sortBy', value)} />}
                </fieldset>
            </div>)}
        </div>
        {error && <p role='alert' className='text-sm text-red-400'>{error}</p>}
        <div className='flex shrink-0 gap-3 border-t border-neutral4 pt-4'><Button onClick={closeModal} className='w-full py-4' disabled={isSaving}>Cancel</Button><Button type='primary' onClick={handleSave} className='w-full py-4' disabled={isSaving} loading={isSaving}>Save</Button></div>
    </div>
}
export default ViewPreferencesModal
