const TextTabSelector = ({ tabs = [], currentIndex = 0, onSelect, notificationTabs = [], className, tabListLabel, disabled = false }) => {

    if (!tabs.length) return null

    // A negative index means nothing in this selector is active, which lets a
    // sibling control (such as Crates) own the selection instead.
    const hasSelection = currentIndex >= 0
    const safeIndex = hasSelection ? currentIndex : 0

    return (
        <div className={`relative p-1 bg-neutral5 rounded-full ${className}`}>
            <div
                className={`absolute top-1 bottom-1 rounded-full bg-neutral6 transition-all duration-300 ease-out
                    ${hasSelection ? 'opacity-100' : 'opacity-0'}`}
                style={{
                    left: '0.25rem',
                    width: `calc((100% - 0.5rem) / ${tabs.length})`,
                    transform: `translateX(${safeIndex * 100}%)`,
                }}
            />

            <div
                role={tabListLabel ? 'tablist' : undefined}
                aria-label={tabListLabel}
                className='relative z-10 grid'
                style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
            >
                {tabs.map((tab, index) => {

                    const isCurrent = hasSelection && safeIndex === index
                    const hasNotification = notificationTabs?.some(x => x === tab.name);

                    return (
                        <button
                            key={tab.name ?? index}
                            type='button'
                            disabled={disabled}
                            role={tabListLabel ? 'tab' : undefined}
                            aria-selected={tabListLabel ? isCurrent : undefined}
                            id={tab.id}
                            aria-controls={tab.panelId}
                            tabIndex={tabListLabel && !isCurrent ? -1 : undefined}
                            onKeyDown={(event) => {
                                if(!tabListLabel || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                                event.preventDefault()
                                const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
                                onSelect?.(tabs[nextIndex], nextIndex)
                                event.currentTarget.parentElement.children[nextIndex]?.focus()
                            }}
                            onClick={() => onSelect?.(tab, index)}
                            className={`w-full px-4 py-2 flex items-center justify-center gap-2 rounded-full text-sm
                                transition-colors cursor-pointer
                                ${isCurrent ? 'text-neutral0' : 'text-neutral1 hover:text-neutral0'
                            }`}
                        >
                            {tab.label ?? tab.name}
                            {hasNotification && <div className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-sky-500' : 'bg-sky-300'} transition`} />}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export default TextTabSelector