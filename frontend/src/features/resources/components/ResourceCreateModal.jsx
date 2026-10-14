import { useState } from 'react'
import { FaArrowLeft, FaCircleExclamation, FaFileLines, FaGlobe, FaVideo } from 'react-icons/fa6'
import Button from '../../../shared/components/ui/Button'
import ChoiceCard from '../../../shared/components/ui/ChoiceCard'
import ProgressBar from '../../../shared/components/ui/ProgressBar'
import TextField from '../../../shared/components/ui/TextField'
import { saveResource } from '../services/resourceService'

const LINK_TYPES = [
    { value: 'document', icon: <FaFileLines />, title: 'Document', description: 'Notes, a worksheet, a PDF.' },
    { value: 'video', icon: <FaVideo />, title: 'Video', description: 'A lecture or walkthrough.' },
    { value: 'website', icon: <FaGlobe />, title: 'Website', description: 'An article or a tool.' },
]

const STEPS = [
    { title: 'What are you sharing?', subtitle: 'Pick the kind of link so people know what to expect.' },
    { title: 'Where does it point?', subtitle: 'Paste the link and give it a name.' },
    { title: 'Anything else?', subtitle: 'A subject and a sentence help people find it. Both optional.' },
]

// Only links come through here — a lesson opens the builder straight away. One decision per
// screen, the same shape as the rest of the app's flows.
const ResourceCreateModal = ({ initial = null, onSaved, onClose }) => {

    const isEditing = Boolean(initial?.id)

    const [draft, setDraft] = useState(() => ({
        type: 'link', title: '', description: '', subject: '', linkType: 'website', url: '', ...(initial ?? {}),
    }))
    const [step, setStep] = useState(isEditing ? 2 : 1)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }))

    const canContinue = () => {
        if(step === 1) return Boolean(draft.linkType)
        if(step === 2) return Boolean(draft.title.trim() && draft.url.trim())
        return true
    }

    const goBack = () => {
        if(step <= 1 || (isEditing && step <= 2)) return onClose()
        setStep(step - 1)
    }

    const save = async () => {

        setSaving(true)
        setError('')

        try {
            onSaved(await saveResource({ ...draft, status: 'published' }))
        } catch (saveError) {
            setError(saveError.message)
            setSaving(false)
        }
    }

    return (
        <div className='flex flex-col gap-6 w-full max-w-lg'>

            <div className='flex flex-col gap-4'>

                <div className='flex items-center gap-3'>

                    <button
                        type='button'
                        onClick={goBack}
                        aria-label={step <= 1 ? 'Close' : 'Go back'}
                        className='p-2 rounded-full text-neutral1 cursor-pointer hover:text-neutral0 hover:bg-neutral5 transition'
                    >
                        <FaArrowLeft />
                    </button>

                    <div className='flex-1 min-w-0'>
                        <h2 className='text-xl font-semibold text-neutral0'>{STEPS[step - 1].title}</h2>
                        <p className='text-sm text-neutral1'>{STEPS[step - 1].subtitle}</p>
                    </div>

                </div>

                <ProgressBar value={step} max={STEPS.length} className='h-2' fillClassName='bg-sky-400!' />

            </div>

            <div className='flex flex-col gap-3 max-h-[55vh] overflow-y-auto px-1'>

                {step === 1 ? LINK_TYPES.map((option) => (
                    <ChoiceCard
                        key={option.value}
                        icon={option.icon}
                        title={option.title}
                        description={option.description}
                        selected={draft.linkType === option.value}
                        onClick={() => { set('linkType', option.value); setStep(2) }}
                    />
                )) : null}

                {step === 2 ? (
                    <>
                        <TextField label='Title' value={draft.title} onChange={(value) => set('title', value)} placeholder='What is it called?' maxLength={120} autoFocus />
                        <TextField label='Link' value={draft.url} onChange={(value) => set('url', value)} placeholder='https://' />
                    </>
                ) : null}

                {step === 3 ? (
                    <>
                        <TextField label='Subject' value={draft.subject} onChange={(value) => set('subject', value)} placeholder='Optional' maxLength={80} />
                        <TextField label='Description' value={draft.description} onChange={(value) => set('description', value)} placeholder='Optional' rows={3} maxLength={1200} />
                    </>
                ) : null}

            </div>

            {error ? (
                <p role='alert' className='flex items-center gap-2 px-1 text-xs text-red-400'>
                    <FaCircleExclamation />{error}
                </p>
            ) : null}

            <div className='flex gap-3 mt-2'>
                {step === STEPS.length ? (
                    <Button type='primary' onClick={save} className='w-full py-4' loading={saving} disabled={saving}>{isEditing ? 'Save' : 'Share'}</Button>
                ) : (
                    <Button type='primary' onClick={() => setStep(step + 1)} className='w-full py-4' disabled={!canContinue()}>Continue</Button>
                )}
            </div>

        </div>
    )
}

export default ResourceCreateModal
