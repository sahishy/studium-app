import { FaArrowUpRightFromSquare } from 'react-icons/fa6'

const hostOf = (url) => {
    try {
        return new URL(url).hostname.replace(/^www\./, '')
    } catch {
        return url
    }
}

const originOf = (url) => {
    try {
        return new URL(url).origin
    } catch {
        return null
    }
}

// A link opens straight away, so the hover card is what tells a reader where they are going
// before they commit. It uses only what we already store plus the site's own favicon — no
// server-side fetch of someone else's page.
const LinkPreview = ({ resource }) => {

    const origin = originOf(resource.url)

    return (
        <div className='pointer-events-none absolute left-4 right-4 bottom-full z-30 mb-2 opacity-0 translate-y-1 transition
            group-hover/card:opacity-100 group-hover/card:translate-y-0'
        >
            <div className='flex flex-col gap-2 p-3 rounded-xl bg-neutral6 dark:bg-neutral4 border border-neutral4 shadow-lg shadow-shadow'>

                <div className='flex items-center gap-2 min-w-0'>
                    {origin ? (
                        <img src={`${origin}/favicon.ico`} alt='' width={16} height={16} className='size-4 shrink-0 rounded' onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} />
                    ) : null}
                    <span className='truncate text-xs font-semibold text-neutral0'>{hostOf(resource.url)}</span>
                    <FaArrowUpRightFromSquare className='ml-auto shrink-0 text-[10px] text-neutral1' />
                </div>

                <p className='break-all line-clamp-2 text-[11px] leading-4 text-neutral1'>{resource.url}</p>

                {resource.description ? <p className='line-clamp-2 text-[11px] leading-4 text-neutral1'>{resource.description}</p> : null}

                <p className='text-[11px] text-neutral2'>Opens the {resource.linkType} in a new tab</p>

            </div>
        </div>
    )
}

export default LinkPreview
