import { FaArrowUpRightFromSquare, FaBook, FaLink } from 'react-icons/fa6'
import AuthorIdentity from '../../profile/components/AuthorIdentity'
import HeartButton from '../../../shared/components/ui/HeartButton'
import { formatRelativeTime } from '../../../shared/utils/formatters'
import LinkPreviewTooltip from './tooltips/LinkPreviewTooltip'
import Card from '../../../shared/components/ui/Card'

const LinkResourceCard = ({ resource, onHeart, pending }) => (
    <div className='flex min-w-0 flex-col gap-4'>
        <LinkPreviewTooltip resource={resource} placement='bottom' className='flex-1'>
            <Card hoverable showArrow={false} className='h-full gap-3!'
                onClick={() => {
                    if(resource.url) window.open(resource.url, '_blank', 'noopener,noreferrer')
                }}>
                <a href={resource.url || undefined} target='_blank' rel='noopener noreferrer' onClick={event => event.stopPropagation()} className='flex flex-1 flex-col gap-1 min-w-0'>
                    <div className='flex min-w-0 items-center gap-2 text-xs font-semibold text-neutral1'>
                        <FaLink className='shrink-0 text-neutral1' />
                        <span className='min-w-0 flex-1 truncate'>{resource.url}</span>
                        {resource.status === 'draft' ? <span className='shrink-0 px-2 py-0.5 rounded-full bg-neutral4'>Draft</span> : null}
                        <FaArrowUpRightFromSquare className='ml-auto shrink-0' />
                    </div>
                    <h3 className='mt-2 font-semibold text-neutral0 break-words'>{resource.title}</h3>
                    {resource.subject ? <p className='flex items-start gap-2 text-xs text-neutral1'>
                        <FaBook className='shrink-0 mt-0.5' />
                        <span className='min-w-0 break-words'>{resource.subject}</span>
                    </p> : null}
                    <p className='mt-2 line-clamp-2 text-sm text-neutral1 break-words'>{resource.description || resource.url}</p>
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
