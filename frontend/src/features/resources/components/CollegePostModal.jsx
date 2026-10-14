import { useState } from 'react'
import { FaArrowLeft, FaCircleCheck, FaCircleExclamation, FaCircleHalfStroke, FaCircleMinus, FaFlag } from 'react-icons/fa6'
import Button from '../../../shared/components/ui/Button'
import ChoiceCard from '../../../shared/components/ui/ChoiceCard'
import ProgressBar from '../../../shared/components/ui/ProgressBar'
import TextField from '../../../shared/components/ui/TextField'
import BooleanSelect from '../../../shared/components/ui/BooleanSelect'
import { saveCollegePost } from '../services/resourceService'

const OUTCOMES = [
    { value: 'accepted', icon: <FaCircleCheck />, title: 'Accepted', description: 'You got in.' },
    { value: 'committed', icon: <FaFlag />, title: 'Committed', description: 'You got in and you are going.' },
    { value: 'waitlisted', icon: <FaCircleHalfStroke />, title: 'Waitlisted', description: 'Still waiting to hear back.' },
    { value: 'rejected', icon: <FaCircleMinus />, title: 'Rejected', description: 'It did not work out.' },
]

const emptyDraft = () => ({
    college: '',
    year: new Date().getFullYear(),
    outcome: '',
    sat: '',
    act: '',
    gpa: '',
    note: '',
    attributed: false,
})

const CollegePostModal = ({ initial = null, onSaved, onClose }) => {

    const [draft, setDraft] = useState(() => (initial ? { ...emptyDraft(), ...initial } : emptyDraft()))
    const [step, setStep] = useState(1)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const totalSteps = 3

    const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }))

    const canContinue = () => {
        if(step === 1) return Boolean(draft.outcome)
        if(step === 2) return Boolean(String(draft.college).trim()) && Boolean(draft.year)
        return true
    }

    const goBack = () => {

        if(step <= 1) {
            onClose()
            return
        }

        setError('')
        setStep((previous) => previous - 1)
    }

    const save = async () => {

        setSaving(true)
        setError('')

        try {
            await saveCollegePost({ ...draft, year: Number(draft.year) })
            await onSaved()
        } catch(saveError) {
            setError(saveError.message)
            setSaving(false)
        }

    }

    const stepTitle = step === 1 ? 'How did it go?' : step === 2 ? 'Which college, and when?' : 'Anything to add?'
    const stepSubtitle = step === 1
        ? 'Pick the outcome you want to share.'
        : step === 2
            ? 'Only what you enter here gets posted.'
            : 'Scores and notes are optional. Posts are anonymous unless you say otherwise.'

    return (
        <div className='flex flex-col gap-6'>

            <div className='flex flex-col gap-4'>

                <div className='flex items-center gap-3'>
                    <button
                        type='button'
                        onClick={goBack}
                        aria-label={step <= 1 ? 'Close' : 'Go back'}
                        className='p-2 rounded-full text-neutral1 hover:text-neutral0 hover:bg-neutral5 transition cursor-pointer'
                    >
                        <FaArrowLeft />
                    </button>

                    <div className='flex-1 min-w-0'>
                        <h2 className='text-xl font-semibold text-neutral0'>{stepTitle}</h2>
                        <p className='text-sm text-neutral1'>{stepSubtitle}</p>
                    </div>
                </div>

                <ProgressBar value={step} max={totalSteps} className='h-2' fillClassName='bg-sky-400!' />

            </div>

            <div className='flex flex-col gap-3 max-h-[55vh] overflow-y-auto px-1'>

                {step === 1 && OUTCOMES.map((option) => (
                    <ChoiceCard
                        key={option.value}
                        icon={option.icon}
                        title={option.title}
                        description={option.description}
                        selected={draft.outcome === option.value}
                        onClick={() => { set('outcome', option.value); setStep(2) }}
                    />
                ))}

                {step === 2 && (
                    <>
                        <TextField
                            label='College'
                            value={draft.college}
                            onChange={(value) => set('college', value)}
                            placeholder='University of Virginia'
                            maxLength={120}
                            autoFocus
                        />
                        <TextField
                            label='Application year'
                            type='number'
                            value={draft.year}
                            onChange={(value) => set('year', value)}
                            placeholder={String(new Date().getFullYear())}
                        />
                    </>
                )}

                {step === 3 && (
                    <>
                        <div className='grid grid-cols-3 gap-3'>
                            <TextField label='GPA' type='number' value={draft.gpa} onChange={(value) => set('gpa', value)} placeholder='4.0' />
                            <TextField label='SAT' type='number' value={draft.sat} onChange={(value) => set('sat', value)} placeholder='1500' />
                            <TextField label='ACT' type='number' value={draft.act} onChange={(value) => set('act', value)} placeholder='34' />
                        </div>

                        <TextField
                            label='Note'
                            value={draft.note}
                            onChange={(value) => set('note', value)}
                            placeholder='What you think made the difference.'
                            rows={3}
                            maxLength={1200}
                        />

                        <div className='flex items-center justify-between gap-3 px-1'>
                            <span className='text-xs font-semibold text-neutral1'>Post as</span>
                            <BooleanSelect
                                value={Boolean(draft.attributed)}
                                onChange={(value) => set('attributed', value)}
                                leftOption={{ value: false, label: 'Anonymous' }}
                                rightOption={{ value: true, label: 'My profile' }}
                            />
                        </div>
                    </>
                )}

            </div>

            {error ? (
                <p role='alert' className='flex items-center gap-2 text-xs text-red-400 px-1'>
                    <FaCircleExclamation />{error}
                </p>
            ) : null}

            <div className='flex gap-3 mt-2'>
                {step === totalSteps ? (
                    <Button type='primary' onClick={save} className='w-full py-4' loading={saving} disabled={saving}>Post</Button>
                ) : (
                    <Button type='primary' onClick={() => setStep((previous) => previous + 1)} className='w-full py-4' disabled={!canContinue()}>Continue</Button>
                )}
            </div>

        </div>
    )
}

export default CollegePostModal
