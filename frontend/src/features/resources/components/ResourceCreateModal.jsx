import { useMemo, useState } from 'react'
import { FaArrowLeft, FaBookOpen, FaCircleExclamation, FaFilm, FaFileLines, FaGlobe, FaLayerGroup, FaLink, FaWandMagicSparkles } from 'react-icons/fa6'
import Button from '../../../shared/components/ui/Button'
import ChoiceCard from '../../../shared/components/ui/ChoiceCard'
import ProgressBar from '../../../shared/components/ui/ProgressBar'
import TextField from '../../../shared/components/ui/TextField'
import LessonBuilder from './LessonBuilder'
import { saveResource } from '../services/resourceService'

const RESOURCE_TYPES = [
    { value: 'link', icon: <FaLink />, title: 'Link', description: 'A page, video, or document worth sharing.' },
    { value: 'lesson', icon: <FaWandMagicSparkles />, title: 'Lesson', description: 'Build it yourself with text, quizzes, and graphs.' },
    { value: 'course', icon: <FaLayerGroup />, title: 'Course', description: 'Put your published lessons in order.' },
]

const LINK_TYPES = [
    { value: 'website', icon: <FaGlobe />, title: 'Website', description: 'An article, guide, or practice site.' },
    { value: 'video', icon: <FaFilm />, title: 'Video', description: 'A lecture, walkthrough, or explainer.' },
    { value: 'document', icon: <FaFileLines />, title: 'Document', description: 'Notes, a slide deck, or a problem set.' },
]

const emptyDraft = () => ({
    type: '',
    title: '',
    description: '',
    subject: '',
    linkType: 'website',
    url: '',
    blocks: [],
    lessonIds: [],
})

const ResourceCreateModal = ({ initial = null, resources = [], userId, onSaved, onClose }) => {

    const [draft, setDraft] = useState(() => (initial ? { ...emptyDraft(), ...initial } : emptyDraft()))
    const [step, setStep] = useState(() => (initial ? 2 : 1))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const isEditing = Boolean(initial?.id)
    const totalSteps = 4

    const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }))

    const myLessons = useMemo(
        () => resources.filter((item) => item.type === 'lesson' && item.status === 'published' && item.ownerId === userId),
        [resources, userId]
    )

    const canContinue = () => {
        if(step === 1) return Boolean(draft.type)
        if(step === 2) return Boolean(draft.title.trim())
        if(step === 3) {
            if(draft.type === 'link') return Boolean(draft.url.trim())
            if(draft.type === 'lesson') return (draft.blocks || []).length > 0
            return (draft.lessonIds || []).length > 0
        }
        return true
    }

    const goBack = () => {
        if(step <= 1 || (isEditing && step <= 2)) {
            onClose()
            return
        }

        setError('')
        setStep((previous) => previous - 1)
    }

    const goForward = () => {
        setError('')
        setStep((previous) => Math.min(totalSteps, previous + 1))
    }

    const save = async (status) => {

        setSaving(true)
        setError('')

        try {
            const result = await saveResource({ ...draft, status })
            onSaved(result)
        } catch(saveError) {
            setError(saveError.message)
            setSaving(false)
        }

    }

    const chooseType = (value) => {
        set('type', value)
        setStep(2)
    }

    const selectedType = RESOURCE_TYPES.find((item) => item.value === draft.type)

    const stepTitle = step === 1
        ? 'What are you sharing?'
        : step === 2
            ? 'The basics'
            : step === 3
                ? selectedType?.title === 'Link' ? 'Where does it point?' : selectedType?.title === 'Lesson' ? 'Build your lesson' : 'Pick your lessons'
                : 'Ready to share?'

    const stepSubtitle = step === 1
        ? 'Pick the format that fits what you have.'
        : step === 2
            ? 'Help other students find it.'
            : step === 3
                ? draft.type === 'link' ? 'Paste the link and tell us what kind it is.' : draft.type === 'lesson' ? 'Add blocks in the order students will read them.' : 'Only your published lessons can be added.'
                : 'Publish now, or keep it as a draft and come back later.'

    const moveLesson = (index, offset) => {
        const next = [...(draft.lessonIds || [])]
        const target = index + offset

        if(target < 0 || target >= next.length) return

        ;[next[index], next[target]] = [next[target], next[index]]
        set('lessonIds', next)
    }

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

                <ProgressBar
                    value={step}
                    max={totalSteps}
                    className='h-2'
                    fillClassName='bg-sky-400!'
                />

            </div>

            <div className='flex flex-col gap-3 max-h-[55vh] overflow-y-auto px-1'>

                {step === 1 && RESOURCE_TYPES.map((option) => (
                    <ChoiceCard
                        key={option.value}
                        icon={option.icon}
                        title={option.title}
                        description={option.description}
                        selected={draft.type === option.value}
                        onClick={() => chooseType(option.value)}
                    />
                ))}

                {step === 2 && (
                    <>
                        <TextField
                            label='Title'
                            value={draft.title}
                            onChange={(value) => set('title', value)}
                            placeholder='Supply and demand, in 5 minutes'
                            maxLength={120}
                            autoFocus
                        />
                        <TextField
                            label='Subject'
                            value={draft.subject}
                            onChange={(value) => set('subject', value)}
                            placeholder='AP Economics'
                            maxLength={80}
                        />
                        <TextField
                            label='Description'
                            value={draft.description}
                            onChange={(value) => set('description', value)}
                            placeholder='One or two lines on what a student will get out of it.'
                            rows={3}
                            maxLength={1200}
                        />
                    </>
                )}

                {step === 3 && draft.type === 'link' && (
                    <>
                        {LINK_TYPES.map((option) => (
                            <ChoiceCard
                                key={option.value}
                                icon={option.icon}
                                title={option.title}
                                description={option.description}
                                selected={draft.linkType === option.value}
                                onClick={() => set('linkType', option.value)}
                            />
                        ))}

                        <TextField
                            label='URL'
                            value={draft.url}
                            onChange={(value) => set('url', value)}
                            placeholder='https://'
                            className='mt-2'
                        />
                    </>
                )}

                {step === 3 && draft.type === 'lesson' && (
                    <LessonBuilder
                        blocks={draft.blocks || []}
                        onChange={(blocks) => set('blocks', blocks)}
                    />
                )}

                {step === 3 && draft.type === 'course' && (
                    <>
                        {(draft.lessonIds || []).map((id, index) => (
                            <div key={id} className='flex items-center gap-2 px-4 py-3 rounded-2xl bg-neutral5'>
                                <span className='shrink-0 size-6 rounded-full bg-neutral6 text-xs font-semibold flex items-center justify-center'>{index + 1}</span>
                                <span className='flex-1 min-w-0 truncate text-sm'>{resources.find((resource) => resource.id === id)?.title || id}</span>
                                <button type='button' aria-label='Move up' onClick={() => moveLesson(index, -1)} className='p-1 text-neutral1 hover:text-neutral0 cursor-pointer'>↑</button>
                                <button type='button' aria-label='Move down' onClick={() => moveLesson(index, 1)} className='p-1 text-neutral1 hover:text-neutral0 cursor-pointer'>↓</button>
                                <button type='button' aria-label='Remove' onClick={() => set('lessonIds', draft.lessonIds.filter((value) => value !== id))} className='p-1 text-neutral1 hover:text-red-400 cursor-pointer'>×</button>
                            </div>
                        ))}

                        {myLessons.filter((lesson) => !(draft.lessonIds || []).includes(lesson.id)).map((lesson) => (
                            <ChoiceCard
                                key={lesson.id}
                                icon={<FaBookOpen />}
                                title={lesson.title}
                                description={lesson.subject || 'Add to this course'}
                                onClick={() => set('lessonIds', [...(draft.lessonIds || []), lesson.id])}
                            />
                        ))}

                        {!myLessons.length && (
                            <p className='px-4 py-6 text-center text-sm text-neutral1'>
                                Publish a lesson first, then you can build a course from it.
                            </p>
                        )}
                    </>
                )}

                {step === 4 && (
                    <div className='flex flex-col gap-3'>
                        <div className='flex items-center gap-4 p-4 rounded-2xl bg-neutral5'>
                            <div className='shrink-0 p-3 rounded-xl bg-sky-500/15 text-sky-500 text-lg'>{selectedType?.icon}</div>
                            <div className='min-w-0'>
                                <p className='text-sm font-semibold truncate'>{draft.title}</p>
                                <p className='text-xs text-neutral1'>{selectedType?.title} · {draft.subject || 'General'}</p>
                            </div>
                        </div>

                        {draft.description ? (
                            <p className='px-1 text-sm text-neutral1'>{draft.description}</p>
                        ) : null}
                    </div>
                )}

            </div>

            {error ? (
                <p role='alert' className='flex items-center gap-2 text-xs text-red-400 px-1'>
                    <FaCircleExclamation />{error}
                </p>
            ) : null}

            <div className='flex justify-end gap-3'>
                {step === totalSteps ? (
                    <>
                        <Button onClick={() => save('draft')} disabled={saving}>Save draft</Button>
                        <Button type='primary' onClick={() => save('published')} loading={saving} disabled={saving}>Publish</Button>
                    </>
                ) : (
                    <Button type='primary' onClick={goForward} disabled={!canContinue()}>Continue</Button>
                )}
            </div>

        </div>
    )
}

export default ResourceCreateModal
