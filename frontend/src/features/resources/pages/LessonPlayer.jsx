import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { FaArrowLeft, FaChevronLeft, FaChevronRight, FaHeart, FaPen } from 'react-icons/fa6'
import ErrorState from '../../../shared/components/ui/ErrorState'
import LoadingState from '../../../shared/components/ui/LoadingState'
import Select from '../../../shared/components/popovers/Select'
import TextTooltip from '../../../shared/components/tooltips/TextTooltip'
import LumenIcon from '../../economy/components/LumenIcon'
import { useEconomy } from '../../economy/EconomyContext'
import { useRewardFx } from '../../economy/RewardFxContext'
import LessonPage from '../components/LessonPage'
import VariableControls from '../components/VariableControls'
import { getResource, reportResource, toggleHeart } from '../services/resourceService'

const TIP_OPTIONS = [10, 25, 50].map((value) => ({ value, label: `${value} Lumen` }))

// Reading a lesson should feel like reading, so the chrome is one slim bar and the page gets
// the rest of the screen. Everything else — tipping, reporting — waits at the end.
const LessonPlayer = () => {

    const { resourceId } = useParams()
    const navigate = useNavigate()
    const { profile } = useOutletContext()
    const { tip } = useEconomy()
    const { celebrateReward } = useRewardFx()

    const [resource, setResource] = useState(null)
    const [index, setIndex] = useState(0)
    const [values, setValues] = useState({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [tipAmount, setTipAmount] = useState(10)

    useEffect(() => {

        let active = true

        getResource(resourceId)
            .then((result) => active && setResource(result))
            .catch((failure) => active && setError(failure.message || 'That lesson could not be opened.'))
            .finally(() => active && setLoading(false))

        return () => { active = false }

    }, [resourceId])

    const pages = useMemo(() => resource?.pages ?? [], [resource])
    const page = pages[index]
    const isOwner = resource?.ownerId === profile.uid

    const go = useCallback((direction) => {
        setIndex((current) => Math.min(Math.max(current + direction, 0), Math.max(pages.length - 1, 0)))
        // Each page starts from its author's values rather than inheriting the last page's.
        setValues({})
    }, [pages.length])

    useEffect(() => {

        const onKey = (event) => {
            if(event.key === 'ArrowRight') go(1)
            if(event.key === 'ArrowLeft') go(-1)
        }

        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)

    }, [go])

    const heart = async () => {

        try {
            const result = await toggleHeart(resource.id)
            setResource((current) => ({ ...current, hearted: result.hearted, heartsCount: result.heartsCount }))
        } catch (failure) {
            setMessage(failure.message)
        }
    }

    const sendTip = async () => {

        try {
            await tip(resource.id, tipAmount)
            celebrateReward({ lumen: tipAmount })
            setMessage(`Sent ${tipAmount} Lumen.`)
        } catch (failure) {
            setMessage(failure.message)
        }
    }

    if(loading) return <LoadingState className='h-full' />
    if(error) return <ErrorState title='Could not open this lesson' description={error} />

    return (
        <div className='flex flex-col h-full overflow-y-auto no-scrollbar bg-neutral5'>

            <div className='sticky top-0 z-10 flex items-center gap-3 px-6 py-3 bg-neutral5/90 backdrop-blur-sm'>

                <TextTooltip text='Back to resources' placement='bottom'>
                    <button type='button' aria-label='Back to resources' onClick={() => navigate('/resources')} className='shrink-0 p-2.5 rounded-full bg-neutral6 text-neutral0 cursor-pointer hover:bg-neutral4 transition-colors'>
                        <FaArrowLeft className='text-sm' />
                    </button>
                </TextTooltip>

                <div className='min-w-0 flex-1'>
                    <h1 className='truncate text-sm font-semibold text-neutral0'>{resource.title}</h1>
                    {resource.subject ? <p className='truncate text-xs text-neutral1'>{resource.subject}</p> : null}
                </div>

                <button
                    type='button'
                    onClick={heart}
                    aria-label={resource.hearted ? 'Remove heart' : 'Heart this lesson'}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full bg-neutral6 text-xs font-semibold cursor-pointer transition-colors
                        ${resource.hearted ? 'text-red-400' : 'text-neutral1 hover:text-red-400'}`}
                >
                    <FaHeart /> {resource.heartsCount || 0}
                </button>

                {isOwner ? (
                    <TextTooltip text='Edit this lesson' placement='bottom'>
                        <button type='button' aria-label='Edit this lesson' onClick={() => navigate(`/resources/build/${resource.id}`)} className='p-2.5 rounded-full bg-neutral6 text-neutral0 cursor-pointer hover:bg-neutral4 transition-colors'>
                            <FaPen className='text-xs' />
                        </button>
                    </TextTooltip>
                ) : null}

            </div>

            <div className='flex flex-col items-center gap-4 w-full max-w-5xl mx-auto px-6 pb-10'>

                {page ? (
                    <>
                        <LessonPage page={page} values={values} />

                        <VariableControls
                            className='w-full'
                            variables={page.variables}
                            values={values}
                            onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
                        />
                    </>
                ) : (
                    <p className='py-20 text-sm text-neutral1'>This lesson has no pages yet.</p>
                )}

                {pages.length > 1 ? (
                    <div className='flex items-center gap-4'>

                        <button type='button' aria-label='Previous page' disabled={index === 0} onClick={() => go(-1)} className='p-3 rounded-full bg-neutral6 text-neutral0 cursor-pointer hover:bg-neutral4 disabled:opacity-40 disabled:cursor-default transition-colors'>
                            <FaChevronLeft className='text-xs' />
                        </button>

                        <div className='flex items-center gap-1.5'>
                            {pages.map((entry, position) => (
                                <button
                                    key={entry.id}
                                    type='button'
                                    aria-label={`Go to page ${position + 1}`}
                                    onClick={() => { setIndex(position); setValues({}) }}
                                    className={`h-2 rounded-full cursor-pointer transition-all ${position === index ? 'w-6 bg-neutral0' : 'w-2 bg-neutral3 hover:bg-neutral2'}`}
                                />
                            ))}
                        </div>

                        <button type='button' aria-label='Next page' disabled={index === pages.length - 1} onClick={() => go(1)} className='p-3 rounded-full bg-neutral6 text-neutral0 cursor-pointer hover:bg-neutral4 disabled:opacity-40 disabled:cursor-default transition-colors'>
                            <FaChevronRight className='text-xs' />
                        </button>

                    </div>
                ) : null}

                {/* The last page is where thanking the author belongs, not the top of the lesson. */}
                {index === pages.length - 1 && !isOwner && resource.status === 'published' ? (
                    <div className='flex flex-wrap items-center justify-center gap-3 pt-4'>

                        <Select options={TIP_OPTIONS} value={tipAmount} onChange={(value) => setTipAmount(Number(value))}>
                            {() => (
                                <button type='button' className='flex items-center gap-2 px-4 py-2 rounded-full bg-neutral6 text-xs font-semibold text-neutral0 cursor-pointer hover:bg-neutral4 transition-colors'>
                                    <LumenIcon className='size-3.5' /> {tipAmount} Lumen
                                </button>
                            )}
                        </Select>

                        <button type='button' onClick={sendTip} className='px-4 py-2 rounded-full bg-neutral0 text-xs font-semibold text-neutral6 cursor-pointer hover:opacity-90 transition-opacity'>
                            Thank the author
                        </button>

                        <button type='button' onClick={() => reportResource(resource.id, 'Reported from the lesson').then(() => setMessage('Thanks. This lesson has been reported.')).catch((failure) => setMessage(failure.message))} className='text-xs text-neutral1 cursor-pointer hover:text-neutral0 transition-colors'>
                            Report
                        </button>

                    </div>
                ) : null}

                {message ? <p role='status' className='text-xs text-neutral1'>{message}</p> : null}

            </div>

        </div>
    )
}

export default LessonPlayer
