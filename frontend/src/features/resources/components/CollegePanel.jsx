import { useEffect, useMemo, useState } from 'react'
import { FaGraduationCap, FaPlus } from 'react-icons/fa6'
import { HiSelector } from 'react-icons/hi'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import TextField from '../../../shared/components/ui/TextField'
import LoadingState from '../../../shared/components/ui/LoadingState'
import ErrorState from '../../../shared/components/ui/ErrorState'
import Select from '../../../shared/components/popovers/Select'
import Modal from '../../../shared/components/modals/Modal'
import CollegePostModal from './CollegePostModal'
import { deleteCollegePost, listCollegePosts, reportCollegePost } from '../services/resourceService'

const OUTCOMES = ['accepted', 'committed', 'waitlisted', 'rejected']

const OUTCOME_STYLES = {
    accepted: 'text-green-500 bg-green-400/15',
    committed: 'text-sky-500 bg-sky-400/15',
    waitlisted: 'text-amber-500 bg-amber-400/15',
    rejected: 'text-red-400 bg-red-400/15',
}

const CollegePanel = () => {

    const [posts, setPosts] = useState([])
    const [draft, setDraft] = useState(null)
    const [collegeFilter, setCollegeFilter] = useState('')
    const [outcomeFilter, setOutcomeFilter] = useState('all')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const load = async () => {

        setLoading(true)

        try {
            setPosts(await listCollegePosts())
            setError('')
        } catch(loadError) {
            setError(loadError.message)
        } finally {
            setLoading(false)
        }

    }

    useEffect(() => { load() }, [])

    const filtered = useMemo(() => posts.filter((post) => {

        if(outcomeFilter !== 'all' && post.outcome !== outcomeFilter) return false
        if(!collegeFilter.trim()) return true

        return post.college.toLowerCase().includes(collegeFilter.trim().toLowerCase())

    }), [posts, collegeFilter, outcomeFilter])

    const outcomeOptions = useMemo(() => [
        { value: 'all', label: 'All outcomes' },
        ...OUTCOMES.map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) })),
    ], [])

    const remove = async (id) => {

        try {
            await deleteCollegePost(id)
            await load()
        } catch(removeError) {
            setError(removeError.message)
        }

    }

    const report = async (id) => {

        try {
            await reportCollegePost(id, 'Reported from college tab')
            setError('Post reported. Thank you.')
        } catch(reportError) {
            setError(reportError.message)
        }

    }

    return (
        <div className='flex flex-col gap-6'>

            <div className='flex flex-wrap items-center gap-3'>

                <TextField
                    value={collegeFilter}
                    onChange={setCollegeFilter}
                    placeholder='Search a college'
                    className='flex-1 min-w-48'
                />

                <Select
                    options={outcomeOptions}
                    value={outcomeFilter}
                    onChange={(value) => setOutcomeFilter(String(value))}
                >
                    {() => (
                        <button
                            type='button'
                            className='flex items-center gap-3 px-4 py-3 rounded-full bg-neutral5 text-sm text-neutral0 hover:bg-neutral4 transition-colors cursor-pointer'
                        >
                            {outcomeOptions.find((option) => option.value === outcomeFilter)?.label}
                            <HiSelector className='text-neutral1' />
                        </button>
                    )}
                </Select>

                <Button type='primary' onClick={() => setDraft({})}>
                    <FaPlus /> Share
                </Button>

            </div>

            <p className='text-xs text-neutral2 px-1'>
                {filtered.length} self-reported {filtered.length === 1 ? 'post' : 'posts'}, shared by students and not verified.
            </p>

            {loading ? (
                <LoadingState className='flex-1' />
            ) : filtered.length ? (
                <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                    {filtered.map((post) => (
                        <Card key={post.id} className='gap-3'>

                            <div className='flex items-start justify-between gap-3'>
                                <div className='min-w-0'>
                                    <h3 className='font-semibold text-neutral0 truncate'>{post.college}</h3>
                                    <p className='text-xs text-neutral1'>
                                        {post.year} · {post.attributed ? post.displayName || 'Student' : 'Anonymous'}
                                    </p>
                                </div>

                                <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold capitalize ${OUTCOME_STYLES[post.outcome]}`}>
                                    {post.outcome}
                                </span>
                            </div>

                            {(post.gpa != null || post.sat != null || post.act != null) ? (
                                <div className='flex flex-wrap gap-2 text-xs font-semibold text-neutral1'>
                                    {post.gpa != null ? <span className='px-2.5 py-1 rounded-full bg-neutral5'>GPA {post.gpa}</span> : null}
                                    {post.sat != null ? <span className='px-2.5 py-1 rounded-full bg-neutral5'>SAT {post.sat}</span> : null}
                                    {post.act != null ? <span className='px-2.5 py-1 rounded-full bg-neutral5'>ACT {post.act}</span> : null}
                                </div>
                            ) : null}

                            {post.note ? (
                                <p className='line-clamp-4 whitespace-pre-wrap text-sm text-neutral1'>{post.note}</p>
                            ) : null}

                            <div className='flex gap-4 text-xs text-neutral2'>
                                {post.isMine ? (
                                    <>
                                        <button type='button' onClick={() => setDraft(post)} className='hover:text-neutral0 transition-colors cursor-pointer'>Edit</button>
                                        <button type='button' onClick={() => remove(post.id)} className='hover:text-red-400 transition-colors cursor-pointer'>Delete</button>
                                    </>
                                ) : (
                                    <button type='button' onClick={() => report(post.id)} className='hover:text-neutral0 transition-colors cursor-pointer'>Report</button>
                                )}
                            </div>

                        </Card>
                    ))}
                </div>
            ) : (
                <ErrorState
                    title='No posts yet'
                    description='Share where you applied and how it went to help the students behind you.'
                />
            )}

            {error ? (
                <p role='alert' className='text-sm text-red-400 px-1'>{error}</p>
            ) : null}

            {draft ? <Modal
                isOpen
                closeModal={() => setDraft(null)}
                maxWidthClass='max-w-xl'
                modalContent={(
                    <CollegePostModal
                        key={draft.id || 'new'}
                        initial={draft.id ? draft : null}
                        onSaved={async () => { setDraft(null); await load() }}
                        onClose={() => setDraft(null)}
                    />
                )}
            /> : null}

        </div>
    )
}

export default CollegePanel
