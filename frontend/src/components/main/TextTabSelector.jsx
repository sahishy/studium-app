const TextTabSelector = ({ tabs = [], currentIndex = 0, onSelect }) => {
    if (!tabs.length) return null

    const safeIndex = currentIndex >= 0 ? currentIndex : 0

    return (
        <div className='relative p-1 bg-neutral5 rounded-full'>
            <div
                className='absolute top-1 bottom-1 rounded-full bg-background1 transition-all duration-300 ease-out'
                style={{
                    left: '0.25rem',
                    width: `calc((100% - 0.5rem) / ${tabs.length})`,
                    transform: `translateX(${safeIndex * 100}%)`,
                }}
            />

            <div
                className='relative z-10 grid'
                style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
            >
                {tabs.map((tab, index) => {
                    const isCurrent = safeIndex === index

                    return (
                        <button
                            key={tab.name ?? index}
                            onClick={() => onSelect?.(tab, index)}
                            className={`w-full px-4 py-2 rounded-full text-sm transition-colors cursor-pointer ${
                                isCurrent ? 'text-neutral0' : 'text-neutral1 hover:text-neutral0'
                            }`}
                        >
                            {tab.label ?? tab.name}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export default TextTabSelector