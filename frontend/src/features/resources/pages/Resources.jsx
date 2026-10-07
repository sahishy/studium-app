import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { FaBookOpen, FaHeart, FaLayerGroup, FaLink, FaPlus, FaWandMagicSparkles } from 'react-icons/fa6'
import { HiSelector } from 'react-icons/hi'
import Topbar from '../../../shared/components/ui/Topbar'
import PageHeader from '../../../shared/components/ui/PageHeader'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import TextTabSelector from '../../../shared/components/ui/TextTabSelector'
import TextField from '../../../shared/components/ui/TextField'
import LoadingState from '../../../shared/components/ui/LoadingState'
import ErrorState from '../../../shared/components/ui/ErrorState'
import Select from '../../../shared/components/popovers/Select'
import AvatarPicture from '../../../shared/components/avatar/AvatarPicture'
import { formatRelativeTime } from '../../../shared/utils/formatters'
import Modal from '../../../shared/components/modals/Modal'
import BooleanSelect from '../../../shared/components/ui/BooleanSelect'
import { useEconomy } from '../../economy/EconomyContext'
import { useQuests } from '../../quests/QuestContext'
import CollegePanel from '../components/CollegePanel'
import ResourceDetail from '../components/ResourceDetail'
import ResourceCreateModal from '../components/ResourceCreateModal'
import { deleteResource, listResources, toggleHeart } from '../services/resourceService'

const TABS = [
    { name: 'learn', label: 'Learn' },
    { name: 'college', label: 'College' },
]

const TYPE_OPTIONS = [
    { value: 'all', label: 'All types' },
    { value: 'link', label: 'Links', icon: <FaLink /> },
    { value: 'lesson', label: 'Lessons', icon: <FaWandMagicSparkles /> },
    { value: 'course', label: 'Courses', icon: <FaLayerGroup /> },
]

const TYPE_ICONS = {
    link: <FaLink />,
    lesson: <FaWandMagicSparkles />,
    course: <FaLayerGroup />,
}

const Resources = () => {

    const { profile } = useOutletContext()
    const { tip } = useEconomy()
    const { reportQuestProgress } = useQuests()

    const [tabIndex, setTabIndex] = useState(0)
    const [resources, setResources] = useState([])
    const [selected, setSelected] = useState(null)
    const [editor, setEditor] = useState(null)
    const [type, setType] = useState('all')
    const [query, setQuery] = useState('')
    const [mine, setMine] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

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

    const shown = useMemo(() => resources.filter((resource) => {

        if(mine && resource.ownerId !== profile.uid) return false
        if(!mine && resource.status !== 'published') return false
        if(type !== 'all' && resource.type !== type) return false

        const search = `${resource.title} ${resource.description || ''} ${resource.subject || ''}`.toLowerCase()
        return search.includes(query.trim().toLowerCase())

    }), [resources, mine, type, query, profile.uid])

    const heart = async (id) => {

        try {
            const result = await toggleHeart(id)
            reportQuestProgress(result)

            setResources((current) => current.map((resource) => resource.id === id
                ? { ...resource, hearted: result.active, heartsCount: result.count }
                : resource))

            setSelected((current) => current?.id === id
                ? { ...current, hearted: result.active, heartsCount: result.count }
                : current)

        } catch(heartError) {
            setError(heartError.message)
        }

    }

    const remove = async (resource) => {

        try {
            await deleteResource(resource.id)
            setSelected(null)
            await load()
        } catch(removeError) {
            setError(removeError.message)
        }

    }

    const closeEditor = async (saved) => {
        reportQuestProgress(saved)
        setEditor(null)
        setSelected(null)
        await load()
    }

    const tab = TABS[tabIndex]?.name ?? 'learn'

    return (
        <div className='flex flex-col h-full overflow-y-auto'>

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
                    <CollegePanel />
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

                            <BooleanSelect
                                value={mine}
                                onChange={setMine}
                                leftOption={{ value: false, label: 'All' }}
                                rightOption={{ value: true, label: 'Mine' }}
                            />

                            <Button type='primary' onClick={() => setEditor({})}>
                                <FaPlus /> Create
                            </Button>

                        </div>

                        {error ? (
                            <ErrorState title='Could not load resources' description={error} />
                        ) : loading ? (
                            <LoadingState className='flex-1' />
                        ) : shown.length ? (
                            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                                {shown.map((resource) => (
                                    <Card
                                        key={resource.id}
                                        hoverable
                                        onClick={() => setSelected(resource)}
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

                                            <button
                                                type='button'
                                                onClick={(event) => { event.stopPropagation(); heart(resource.id) }}
                                                disabled={resource.status !== 'published'}
                                                aria-label={`${resource.hearted ? 'Remove heart from' : 'Heart'} ${resource.title}`}
                                                className={`flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer
                                                    disabled:opacity-40 disabled:cursor-not-allowed
                                                    ${resource.hearted ? 'text-red-400' : 'text-neutral1 hover:text-red-400'}`}
                                            >
                                                <FaHeart /> {resource.heartsCount || 0}
                                            </button>

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
                                description={mine ? 'Create your first resource to see it here.' : 'Be the first to share something with your school.'}
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
                        resources={resources}
                        userId={profile.uid}
                        onSaved={closeEditor}
                        onClose={() => setEditor(null)}
                    />
                )}
            /> : null}

            {selected ? <Modal
                isOpen
                closeModal={() => setSelected(null)}
                maxWidthClass='max-w-3xl'
                modalContent={(
                    <ResourceDetail
                        resource={selected}
                        userId={profile.uid}
                        onClose={() => setSelected(null)}
                        onEdit={(resource) => { setSelected(null); setEditor(resource) }}
                        onDelete={remove}
                        onHeart={heart}
                        onTip={tip}
                    />
                )}
            /> : null}

        </div>
    )
}

export default Resources
