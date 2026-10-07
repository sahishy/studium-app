import { useEffect, useState } from 'react'
import { FaArrowUpRightFromSquare, FaHeart, FaTrash } from 'react-icons/fa6'
import Button from '../../../shared/components/ui/Button'
import LoadingState from '../../../shared/components/ui/LoadingState'
import Select from '../../../shared/components/popovers/Select'
import LumenIcon from '../../economy/components/LumenIcon'
import { useRewardFx } from '../../economy/RewardFxContext'
import InteractiveGraph from './InteractiveGraph'
import { getResource, reportResource } from '../services/resourceService'

const TIP_OPTIONS = [10, 25, 50].map((value) => ({ value, label: `${value} Lumen` }))

const QuizBlock = ({ block }) => {

    const [answer, setAnswer] = useState(null)

    return (
        <section className='flex flex-col gap-2 p-4 rounded-2xl bg-neutral5'>

            <h3 className='font-semibold text-neutral0'>{block.prompt}</h3>

            {block.options.map((option, index) => {

                const isPicked = answer === index
                const isCorrect = index === block.answerIndex

                return (
                    <button
                        key={index}
                        type='button'
                        onClick={() => setAnswer(index)}
                        className={`w-full px-4 py-2.5 rounded-xl text-left text-sm border transition-colors cursor-pointer
                            ${isPicked
                                ? isCorrect
                                    ? 'border-green-400 bg-green-400/15 text-green-500'
                                    : 'border-red-400 bg-red-400/15 text-red-500'
                                : 'border-neutral4 bg-neutral6 dark:bg-neutral4 hover:border-neutral3'}`}
                    >
                        {option}
                    </button>
                )
            })}

            {answer != null ? (
                <p role='status' className='text-sm text-neutral1'>
                    {answer === block.answerIndex ? 'Correct!' : `The answer is ${block.options[block.answerIndex]}.`} {block.explanation}
                </p>
            ) : null}

        </section>
    )
}

const LessonBody = ({ blocks = [] }) => (
    <div className='flex flex-col gap-4'>
        {blocks.map((block) => {

            if(block.type === 'text') {
                return <p key={block.id} className='whitespace-pre-wrap text-sm leading-7 text-neutral0'>{block.text}</p>
            }

            if(block.type === 'media') {
                return (
                    <a
                        key={block.id}
                        href={block.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='flex items-center gap-2 p-4 rounded-2xl bg-neutral5 text-sm text-sky-500 hover:bg-neutral4 transition-colors'
                    >
                        {block.caption || block.url} <FaArrowUpRightFromSquare className='text-xs' />
                    </a>
                )
            }

            if(block.type === 'quiz') {
                return <QuizBlock key={block.id} block={block} />
            }

            return <InteractiveGraph key={block.id} block={block} />
        })}
    </div>
)

const ResourceDetail = ({ resource, userId, onEdit, onDelete, onHeart, onTip }) => {

    const { celebrateReward } = useRewardFx()

    const [lessons, setLessons] = useState([])
    const [lessonsLoaded, setLessonsLoaded] = useState(false)
    const [tipAmount, setTipAmount] = useState(10)
    const [message, setMessage] = useState('')
    const [busy, setBusy] = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(false)

    const isOwner = resource.ownerId === userId

    useEffect(() => {

        if(resource.type !== 'course') return

        setLessonsLoaded(false)

        Promise.all((resource.lessonIds || []).map((id) => getResource(id).catch(() => null)))
            .then((items) => {
                setLessons(items.filter(Boolean))
                setLessonsLoaded(true)
            })

    }, [resource])

    const sendTip = async () => {

        setBusy(true)
        setMessage('')

        try {
            await onTip(resource.id, tipAmount)
            celebrateReward({ lumen: tipAmount })
            setMessage(`Sent ${tipAmount} Lumen.`)
        } catch(tipError) {
            setMessage(tipError.message)
        } finally {
            setBusy(false)
        }

    }

    const report = async () => {

        try {
            await reportResource(resource.id, 'Reported from resource detail')
            setMessage('Thanks. This resource has been reported.')
        } catch(reportError) {
            setMessage(reportError.message)
        }

    }

    return (
        <div className='flex flex-col gap-5 max-h-[75vh] overflow-y-auto px-1'>

            <div className='flex flex-col gap-1'>
                <p className='text-xs font-semibold uppercase text-neutral1'>
                    {resource.type} · {resource.subject || 'General'}
                </p>
                <h2 className='text-2xl font-semibold text-neutral0'>{resource.title}</h2>
                {resource.description ? (
                    <p className='text-sm text-neutral1'>{resource.description}</p>
                ) : null}
            </div>

            <div className='flex flex-wrap items-center gap-3'>

                <button
                    type='button'
                    onClick={() => onHeart(resource.id)}
                    disabled={resource.status !== 'published'}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full bg-neutral5 text-sm font-semibold
                        transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                        ${resource.hearted ? 'text-red-400' : 'text-neutral1 hover:text-red-400'}`}
                >
                    <FaHeart /> {resource.heartsCount || 0}
                </button>

                {isOwner ? (
                    <>
                        <Button onClick={() => onEdit(resource)}>Edit</Button>

                        {confirmingDelete ? (
                            <Button type='negative' onClick={() => onDelete(resource)}>
                                <FaTrash /> Confirm delete
                            </Button>
                        ) : (
                            <Button onClick={() => setConfirmingDelete(true)}>
                                <FaTrash /> Remove
                            </Button>
                        )}
                    </>
                ) : resource.status === 'published' ? (
                    <>
                        <Select
                            options={TIP_OPTIONS}
                            value={tipAmount}
                            onChange={(value) => setTipAmount(Number(value))}
                        >
                            {() => (
                                <button
                                    type='button'
                                    className='flex items-center gap-2 px-4 py-2 rounded-full bg-neutral5 text-sm font-semibold text-sky-500 hover:bg-neutral4 transition-colors cursor-pointer'
                                >
                                    <LumenIcon className='size-4' /> {tipAmount}
                                </button>
                            )}
                        </Select>

                        <Button type='primary' onClick={sendTip} loading={busy} disabled={busy}>
                            Thank creator
                        </Button>

                        <button
                            type='button'
                            onClick={report}
                            className='text-xs text-neutral2 hover:text-neutral1 transition-colors cursor-pointer'
                        >
                            Report
                        </button>
                    </>
                ) : null}

            </div>

            {message ? (
                <p role='status' className='text-sm text-neutral1'>{message}</p>
            ) : null}

            {resource.type === 'link' ? (
                <a
                    href={resource.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex flex-col gap-1 p-5 rounded-2xl bg-neutral5 hover:bg-neutral4 transition-colors'
                >
                    <span className='flex items-center gap-2 text-sm font-semibold text-sky-500'>
                        Open {resource.linkType} <FaArrowUpRightFromSquare className='text-xs' />
                    </span>
                    <span className='truncate text-xs text-neutral1'>{resource.url}</span>
                </a>
            ) : null}

            {resource.type === 'lesson' ? <LessonBody blocks={resource.blocks} /> : null}

            {resource.type === 'course' ? (
                <div className='flex flex-col gap-5'>
                    {lessons.map((lesson, index) => (
                        <section key={lesson.id} className='flex flex-col gap-3 pt-4 border-t border-neutral4'>
                            <h3 className='text-lg font-semibold text-neutral0'>{index + 1}. {lesson.title}</h3>
                            {lesson.description ? <p className='text-sm text-neutral1'>{lesson.description}</p> : null}
                            <LessonBody blocks={lesson.blocks} />
                        </section>
                    ))}

                    {!lessonsLoaded ? <LoadingState /> : null}

                    {lessonsLoaded && lessons.length < (resource.lessonIds || []).length ? (
                        <p className='text-sm text-neutral1'>Some lessons are unavailable.</p>
                    ) : null}
                </div>
            ) : null}

        </div>
    )
}

export default ResourceDetail
