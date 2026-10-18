import { FaArrowUpRightFromSquare, FaBook, FaLink, FaFileLines, FaVideo, FaGlobe } from 'react-icons/fa6'
import AuthorIdentity from '../../profile/components/AuthorIdentity'
import HeartButton from '../../../shared/components/ui/HeartButton'
import { formatRelativeTime } from '../../../shared/utils/formatters'
import LinkPreviewTooltip from './tooltips/LinkPreviewTooltip'
import Card from '../../../shared/components/ui/Card'

const TYPE_DETAILS = { document: { label: 'Document', icon: FaFileLines }, video: { label: 'Video', icon: FaVideo }, website: { label: 'Website', icon: FaGlobe } }

const ResourceType = ({ type }) => {
    const details = TYPE_DETAILS[type]
    if(!details) return null
    const Icon = details.icon
    return <p className='flex items-center gap-2 text-xs text-neutral1'><Icon className='shrink-0' /><span>{details.label}</span></p>
}

const LinkResourceCard = ({ resource, onHeart, pending }) => (
    <div className='flex min-w-0 flex-col gap-3 self-start'>
        <LinkPreviewTooltip resource={resource} placement='cursor' className='w-full'>
            <Card hoverable showArrow={false} className='gap-2!'
                onClick={() => {
                    if(resource.url) window.open(resource.url, '_blank', 'noopener,noreferrer')
                }}>
                <a href={resource.url || undefined} target='_blank' rel='noopener noreferrer' onClick={event => event.stopPropagation()} className='flex flex-col gap-1 min-w-0'>
                    <div className='flex min-w-0 items-center gap-2 text-xs font-semibold text-neutral1'>
                        <FaLink className='shrink-0 text-neutral1' />
                        <span className='min-w-0 flex-1 truncate'>{resource.url}</span>
                        {resource.status === 'draft' ? <span className='shrink-0 px-2 py-0.5 rounded-full bg-neutral4'>Draft</span> : null}
                        <FaArrowUpRightFromSquare className='ml-auto shrink-0' />
                    </div>
                    <h3 className='mt-2 font-semibold text-neutral0 break-words'>{resource.title}</h3>
                    <ResourceType type={resource.linkType} />
                    {resource.subject ? <p className='mt-0.5 flex items-start gap-2 text-xs text-neutral1'>
                        <FaBook className='shrink-0 mt-0.5' />
                        <span className='min-w-0 break-words'>{resource.subject}</span>
                    </p> : null}
                </a>
                <div className='flex items-center justify-between gap-3'>
                    <span className='text-xs text-neutral2'>{formatRelativeTime(resource.createdAt)}</span>
                    <HeartButton active={resource.hearted} count={resource.heartsCount} disabled={pending || resource.status !== 'published'} onClick={event => { event.stopPropagation(); onHeart() }} label={resource.title} />
                </div>
            </Card>
        </LinkPreviewTooltip>
        <AuthorIdentity author={resource.author} compact />
    </div>
)

export default LinkResourceCard
