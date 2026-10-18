import { useMemo, useState } from 'react'
import { FaArrowLeft, FaCircleExclamation, FaFileLines, FaGlobe, FaMagnifyingGlass, FaVideo, FaXmark } from 'react-icons/fa6'
import Button from '../../../shared/components/ui/Button'
import ChoiceCard from '../../../shared/components/ui/ChoiceCard'
import ProgressBar from '../../../shared/components/ui/ProgressBar'
import CourseCommandPalette from '../../courses/components/commandPalettes/CourseCommandPalette'
import { getCourseById, getCourseSubjects, searchCourses } from '../../courses/services/courseService'
import { saveResource } from '../services/resourceService'

const LINK_TYPES = [
    { value: 'document', icon: <FaFileLines />, title: 'Document', description: 'Notes, a worksheet, a PDF.' },
    { value: 'video', icon: <FaVideo />, title: 'Video', description: 'A lecture or walkthrough.' },
    { value: 'website', icon: <FaGlobe />, title: 'Website', description: 'An article or a tool.' },
]

const STEPS = [
    { title: 'What are you sharing?', subtitle: 'Pick the kind of link so people know what to expect.' },
    { title: 'Where does it point?', subtitle: 'Paste the link to your resource.' },
    { title: 'Name your resource', subtitle: 'Add a title and, optionally, choose a subject.' },
]

// Only links come through here — a lesson opens the builder straight away. One decision per
// screen, the same shape as the rest of the app's flows.
const ResourceCreateModal = ({ initial = null, onSaved, onClose }) => {

    const isEditing = Boolean(initial?.id)

    const [draft, setDraft] = useState(() => ({
        type: 'link', title: '', subject: '', courseId: '', linkType: '', url: '', ...(initial ?? {}),
    }))
    const [step, setStep] = useState(isEditing ? 2 : 1)
    const [paletteOpen, setPaletteOpen] = useState(false)
    const [query, setQuery] = useState('')
    const subjects = useMemo(() => getCourseSubjects(), [])
    const [activeSubject, setActiveSubject] = useState(subjects[0] ?? null)
    const [visibleCount, setVisibleCount] = useState(10)
    const searchResults = useMemo(() => searchCourses(query.trim(), query.trim() ? {} : { subject: activeSubject }), [query, activeSubject])
    const selectedCourse = getCourseById(draft.courseId)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }))

    const canContinue = () => {
        if(step === 1) return Boolean(draft.linkType)
        if(step === 2) return Boolean(draft.url.trim())
        return Boolean(draft.title.trim())
    }

    const goBack = () => {
        if(step <= 1 || (isEditing && step <= 2)) return onClose()
        setStep(step - 1)
    }

    const save = async () => {

        if(!draft.title.trim() || !draft.url.trim() || !draft.linkType) return
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

                <ProgressBar value={step - 1} max={STEPS.length} className='h-2' fillClassName='bg-sky-400!' />

            </div>

            <div className='flex flex-col gap-3 max-h-[55vh] overflow-y-auto px-1'>

                {step === 1 ? LINK_TYPES.map((option) => (
                    <ChoiceCard
                        key={option.value}
                        icon={option.icon}
                        title={option.title}
                        description={option.description}
                        selected={draft.linkType === option.value}
                        onClick={() => set('linkType', option.value)}
                    />
                )) : null}

                {step === 2 ? (
                    <>
                        <label className='flex flex-col gap-2 mb-1'>
                            <span className='text-sm text-neutral1'>Link</span>
                            <input type='url' value={draft.url} onChange={event => set('url', event.target.value)} placeholder='https://' autoFocus className='w-full p-4 border-2 border-neutral4 rounded-xl outline-none focus:border-gray-400' />
                        </label>
                    </>
                ) : null}

                {step === 3 ? (
                    <>
                        <label className='flex flex-col gap-2 mb-1'>
                            <span className='text-sm text-neutral1'>Title</span>
                            <input type='text' value={draft.title} onChange={event => set('title', event.target.value)} placeholder='Ex. My useful chemistry tips' maxLength={120} autoFocus className='w-full p-4 border-2 border-neutral4 rounded-xl outline-none focus:border-gray-400' />
                        </label>
                        <div className='flex flex-col gap-2 mb-1'>
                            <span className='text-sm text-neutral1'>Subject (optional)</span>
                            <div className='relative'>
                                <button type='button' onClick={() => setPaletteOpen(true)} className={`w-full h-[60px] pl-6 ${draft.courseId ? 'pr-14' : 'pr-6'} text-sm bg-neutral5 rounded-full text-neutral1 hover:bg-neutral4 cursor-pointer flex gap-3 items-center text-left transition-colors focus-visible:outline-none focus-visible:bg-neutral4`}>
                                    <FaMagnifyingGlass className='shrink-0 text-neutral0' />
                                    <span className='min-w-0 truncate'>{selectedCourse?.title || 'Search courses...'}</span>
                                </button>
                                {draft.courseId ? (
                                    <button type='button' aria-label='Clear course' onClick={() => setDraft(current => ({ ...current, courseId: '', subject: '' }))} className='absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full text-neutral2 hover:text-neutral0 hover:bg-neutral4 cursor-pointer transition-colors'>
                                        <FaXmark className='text-sm' />
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </>
                ) : null}

            </div>

            {error ? (
                <p role='alert' className='flex items-center gap-2 px-1 text-xs text-red-400'>
                    <FaCircleExclamation />{error}
                </p>
            ) : null}

            <CourseCommandPalette
                isOpen={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                query={query}
                onQueryChange={value => { setQuery(value); setVisibleCount(10) }}
                subjects={subjects}
                activeSubject={activeSubject}
                onSubjectChange={value => { setActiveSubject(value); setVisibleCount(10) }}
                searchResults={searchResults}
                visibleSearchResults={searchResults.slice(0, visibleCount)}
                visibleSubjectCourses={searchResults.slice(0, visibleCount)}
                canLoadMoreSearch={searchResults.length > visibleCount}
                canLoadMoreSubject={searchResults.length > visibleCount}
                onLoadMoreSearch={() => setVisibleCount(count => count + 10)}
                onLoadMoreSubject={() => setVisibleCount(count => count + 10)}
                onSelectCourse={course => {
                    setDraft(current => ({ ...current, courseId: String(course.courseId), subject: course.title }))
                    setPaletteOpen(false)
                }}
            />

            <div className='flex gap-3 mt-2'>
                {step === STEPS.length ? (
                    <Button type='primary' onClick={save} className='w-full py-4' loading={saving} disabled={saving || !canContinue()}>{isEditing ? 'Save' : 'Share'}</Button>
                ) : (
                    <Button type='primary' onClick={() => setStep(step + 1)} className='w-full py-4' disabled={!canContinue()}>Continue</Button>
                )}
            </div>

        </div>
    )
}

export default ResourceCreateModal
