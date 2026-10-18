import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOutletContext } from 'react-router-dom'
import { FaBookOpen, FaFileLines, FaGlobe, FaLink, FaPlus, FaVideo, FaWandMagicSparkles } from 'react-icons/fa6'
import { HiSelector } from 'react-icons/hi'
import Topbar from '../../../shared/components/ui/Topbar'
import PageHeader from '../../../shared/components/ui/PageHeader'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import TextTabSelector from '../../../shared/components/ui/TextTabSelector'
import TextField from '../../../shared/components/ui/TextField'
import LoadingState from '../../../shared/components/ui/LoadingState'
import ErrorState from '../../../shared/components/ui/ErrorState'
import ComingSoon from '../../../shared/components/ui/ComingSoon'
import Select from '../../../shared/components/popovers/Select'
import AvatarPicture from '../../../shared/components/avatar/AvatarPicture'
import { formatRelativeTime } from '../../../shared/utils/formatters'
import Modal from '../../../shared/components/modals/Modal'
import { useQuests } from '../../quests/QuestContext'
import ResourceCreateModal from '../components/ResourceCreateModal'
import LinkResourceCard from '../components/LinkResourceCard'
import HeartButton from '../../../shared/components/ui/HeartButton'
import Dropdown from '../../../shared/components/popovers/Dropdown'
import { listResources, toggleHeart } from '../services/resourceService'

const TABS = [
    { name: 'learn', label: 'Learn' },
    { name: 'college', label: 'College' },
]

const TYPE_OPTIONS = [
    { value: 'all', label: 'All types' },
    { value: 'document', label: 'Document', icon: <FaFileLines /> },
    { value: 'video', label: 'Video', icon: <FaVideo /> },
    { value: 'website', label: 'Website', icon: <FaGlobe /> },
]

const TYPE_ICONS = {
    link: <FaLink />,
    lesson: <FaWandMagicSparkles />,
}

const Resources = () => {

    const { profile } = useOutletContext()
    const navigate = useNavigate()
    const { reportQuestProgress } = useQuests()

    const [tabIndex, setTabIndex] = useState(0)
    const [resources, setResources] = useState([])
    const [editor, setEditor] = useState(null)
    const [type, setType] = useState('all')
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const pendingHearts = useRef(new Set())
    const [heartPendingIds, setHeartPendingIds] = useState(new Set())

    const load = async () => {

        setLoading(true)

        try {
            setResources(await listResources(true))
            setError('')
        } catch(loadError) {
            setError(loadError.message)
        } finally {
            setLoading(false)
        }

    }

    useEffect(() => { load() }, [])

    // Your own work comes first — including your drafts, which nobody else can see — and
    // everything else follows, newest first. No filter to set, because the useful order is
    // the same every time.
    const shown = useMemo(() => resources.filter((resource) => {

        const isMine = resource.ownerId === profile.uid

        if(!isMine && resource.status !== 'published') return false
        if(type !== 'all' && (resource.type !== 'link' || resource.linkType !== type)) return false

        const search = `${resource.title} ${resource.description || ''} ${resource.subject || ''}`.toLowerCase()
        return search.includes(query.trim().toLowerCase())

    }).sort((left, right) => {

        const mineFirst = Number(right.ownerId === profile.uid) - Number(left.ownerId === profile.uid)
        return mineFirst || new Date(right.createdAt || 0) - new Date(left.createdAt || 0)

    }), [resources, type, query, profile.uid])

    const heart = async (id) => {
        if(pendingHearts.current.has(id)) return
        pendingHearts.current.add(id)
        setHeartPendingIds(new Set(pendingHearts.current))
        try {
            const result = await toggleHeart(id)
            reportQuestProgress(result)

            setResources((current) => current.map((resource) => resource.id === id
                ? { ...resource, hearted: result.active, heartsCount: result.count }
                : resource))

        } catch(heartError) {
            setError(heartError.message)
        } finally {
            pendingHearts.current.delete(id)
            setHeartPendingIds(new Set(pendingHearts.current))
        }

    }

    const closeEditor = async (saved) => {
        reportQuestProgress(saved)
        setEditor(null)
        await load()
    }

    const tab = TABS[tabIndex]?.name ?? 'learn'

    return (
        <div data-onboarding="resources:content" className='flex flex-col h-full overflow-y-auto'>

            <Topbar profile={profile} />

            <div className='w-full flex-1 flex flex-col gap-6 px-4 pb-24 pt-2 sm:px-8 lg:px-16 xl:px-24'>

                <div className='flex flex-wrap justify-between items-start gap-4'>
                    <PageHeader text='Resources' icon={FaBookOpen} />

                    <TextTabSelector
                        tabs={TABS}
                        currentIndex={tabIndex}
                        onSelect={(_, index) => setTabIndex(index)}
                    />
                </div>

                {tab === 'college' ? (
                    // Temporarily paused: <CollegePanel />
                    <ComingSoon description='Explore college stats and student admissions experiences.' />
                ) : (
                    <>
                        <div className='flex flex-wrap items-center gap-3'>

                            <TextField
                                value={query}
                                onChange={setQuery}
                                placeholder='Search resources'
                                className='flex-1 min-w-48'
                            />

                            <Select
                                options={TYPE_OPTIONS}
                                value={type}
                                onChange={(value) => setType(value)}
                            >
                                {() => (
                                    <button
                                        type='button'
                                        className='flex items-center gap-3 px-4 py-3 rounded-full bg-neutral5 text-sm text-neutral0 hover:bg-neutral4 transition-colors cursor-pointer'
                                    >
                                        {TYPE_OPTIONS.find((option) => option.value === type)?.label}
                                        <HiSelector className='text-neutral1' />
                                    </button>
                                )}
                            </Select>

                            <Dropdown
                                options={[
                                    { label: 'Link', icon: <FaLink className='text-sm' /> },
                                    { label: 'Lesson', icon: <FaWandMagicSparkles className='text-sm' />, disabled: true, badge: 'Coming soon' },
                                ]}
                                onSelect={(option) => {
                                    if(option.label === 'Link') setEditor({ type: 'link' })
                                }}
                                align='end'
                            >
                                {() => (
                                    <Button type='primary'>
                                        <FaPlus /> Create
                                    </Button>
                                )}
                            </Dropdown>

                        </div>

                        {error ? (
                            <ErrorState title='Could not load resources' description={error} />
                        ) : loading ? (
                            <LoadingState className='flex-1' />
                        ) : shown.length ? (
                            <div className='grid gap-x-4 gap-y-10 md:grid-cols-2 xl:grid-cols-3'>
                                {shown.map((resource) => resource.type === 'link' ? (
                                    <LinkResourceCard key={resource.id} resource={resource} pending={heartPendingIds.has(resource.id)} onHeart={() => heart(resource.id)} />
                                ) : (
                                    <Card
                                        key={resource.id}
                                        hoverable
                                        onClick={() => {
                                            // A link is its destination, so it opens rather than
                                            // explaining itself in a modal first.
                                            if(resource.type === 'link' && resource.url) return window.open(resource.url, '_blank', 'noopener,noreferrer')
                                            // A lesson is something you do, so it opens on its own screen.
                                            navigate(`/resources/lesson/${resource.id}`)
                                        }}
                                        className='gap-3'
                                    >
                                        <div className='flex items-start justify-between gap-3'>

                                            <div className='flex items-center gap-2 text-xs font-semibold text-neutral1'>
                                                <span className='text-sky-500'>{TYPE_ICONS[resource.type]}</span>
                                                <span className='truncate'>{resource.subject || 'General'}</span>
                                                {resource.status === 'draft' ? (
                                                    <span className='px-2 py-0.5 rounded-full bg-neutral5 text-neutral1'>Draft</span>
                                                ) : null}
                                            </div>

                                            <HeartButton
                                                onClick={(event) => { event.stopPropagation(); heart(resource.id) }}
                                                disabled={heartPendingIds.has(resource.id) || resource.status !== 'published'}
                                                active={resource.hearted}
                                                count={resource.heartsCount}
                                                label={resource.title}
                                            />

                                        </div>

                                        <h3 className='font-semibold text-neutral0 truncate'>{resource.title}</h3>

                                        <p className='line-clamp-2 flex-1 text-sm text-neutral1 pr-10'>
                                            {resource.description || (resource.type === 'link' ? resource.url : 'Open to explore.')}
                                        </p>

                                        <div className='flex items-center justify-between gap-3 pt-1'>

                                            <div className='flex min-w-0 items-center gap-2'>
                                                <AvatarPicture profile={resource.author} className='size-6 shrink-0' />
                                                <span className='truncate text-xs font-semibold text-neutral1'>
                                                    {resource.author?.profile?.displayName || 'Student'}
                                                </span>
                                            </div>

                                            <span className='shrink-0 text-xs text-neutral2'>
                                                {formatRelativeTime(resource.createdAt)}
                                            </span>

                                        </div>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <ErrorState
                                title='Nothing here yet'
                                description='Be the first to share something with other students.'
                            />
                        )}
                    </>
                )}

            </div>

            {editor ? <Modal
                isOpen
                closeModal={() => setEditor(null)}
                maxWidthClass='max-w-xl'
                modalContent={(
                    <ResourceCreateModal
                        key={editor.id || 'new'}
                        initial={editor.id ? editor : null}
                        onSaved={closeEditor}
                        onClose={() => setEditor(null)}
                    />
                )}
            /> : null}


        </div>
    )
}

export default Resources
