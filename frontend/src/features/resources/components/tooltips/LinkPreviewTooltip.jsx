import { useState } from 'react'
import BaseTooltip from '../../../../shared/components/tooltips/BaseTooltip'
import { websiteScreenshotUrl } from '../../utils/websiteScreenshot'

// BaseTooltip mounts this content only when the tooltip opens, so screenshots
// are requested on hover or focus rather than while loading the resource grid.
const WebsitePreview = ({ resource, source }) => {
    const [loaded, setLoaded] = useState(false)
    const [failed, setFailed] = useState(false)

    if(failed) return null

    return (
        <div role='tooltip' className='w-80 max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-neutral4 bg-neutral6 shadow-lg shadow-shadow'>
            <img
                src={source}
                alt={`Screenshot of ${resource.title || 'the linked website'}`}
                width={600}
                height={375}
                referrerPolicy='no-referrer'
                decoding='async'
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
                className={`block w-full aspect-[8/5] object-cover object-top transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
        </div>
    )
}

const LinkPreviewTooltip = ({ children, resource, placement = 'bottom', className = '', disabled = false }) => {
    const source = websiteScreenshotUrl(resource.url)

    return (
        <BaseTooltip
            content={source ? <WebsitePreview key={source} resource={resource} source={source} /> : null}
            placement={placement}
            className={className}
            disabled={disabled || !source}
            gap={6}
        >
            {children}
        </BaseTooltip>
    )
}

export default LinkPreviewTooltip
