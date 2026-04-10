import TextTooltip from '../tooltips/TextTooltip.jsx'

const formatLabel = (tab) => {
    if (tab.label) return tab.label
    if (!tab.name) return ''
    return tab.name.charAt(0).toUpperCase() + tab.name.slice(1)
}

const ConditionalTooltip = ({ children, label, isCurrent }) => {
    return (
        <TextTooltip text={label} disabled={isCurrent}>
            {children}
        </TextTooltip>
    )
}


const IconTabSelector = ({ tabs = [], currentIndex = 0, onSelect }) => {
    if (!tabs.length) return null

    const safeIndex = currentIndex >= 0 ? currentIndex : 0

    return (
        <div className='flex items-center gap-2'>
            {tabs.map((tab, index) => {
                const isCurrent = safeIndex === index
                const label = formatLabel(tab)

                return (
                    <ConditionalTooltip key={tab.name ?? index} label={label} isCurrent={isCurrent}>
                        <button
                            onClick={() => onSelect?.(tab, index)}
                            className={`h-11 rounded-full bg-neutral5 flex items-center justify-center cursor-pointer shrink-0 overflow-hidden motion-reduce:transition-none transition-[width,color] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                                isCurrent
                                    ? 'w-32 text-neutral0'
                                    : 'w-11 text-neutral1 hover:text-neutral0'
                            }`}
                        >
                            <span className='flex items-center justify-center size-5 shrink-0'>
                                {tab.icon}
                            </span>

                            <span
                                className={`whitespace-nowrap text-sm overflow-hidden transition-[width,opacity,margin] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                                    isCurrent
                                        ? 'w-min opacity-100 ml-2 delay-100'
                                        : 'w-0 opacity-0 ml-0 delay-0'
                                }`}
                            >
                                {label}
                            </span>
                        </button>
                    </ConditionalTooltip>
                )
            })}
        </div>
    )
}

export default IconTabSelector