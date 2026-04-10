const BooleanSelect = ({
    leftOption,
    rightOption,
    value,
    onChange,
}) => {
    const options = [leftOption, rightOption].filter(Boolean)

    if(options.length !== 2) {
        return null
    }

    const selectedIndex = options.findIndex((option) => option.value === value)
    const safeIndex = selectedIndex >= 0 ? selectedIndex : 0

    return (
        <div className='relative p-1 bg-neutral5 rounded-xl'>
            <div
                className='absolute top-1 bottom-1 rounded-lg bg-background1 transition-all duration-300 ease-out'
                style={{
                    left: '0.25rem',
                    width: 'calc((100% - 0.5rem) / 2)',
                    transform: `translateX(${safeIndex * 100}%)`,
                }}
            />

            <div className='relative z-10 grid grid-cols-2'>
                {options.map((option, index) => {
                    const isCurrent = safeIndex === index

                    return (
                        <button
                            key={option.value}
                            type='button'
                            onClick={() => onChange?.(option.value)}
                            className={`w-full px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                                isCurrent ? 'text-neutral0' : 'text-neutral1 hover:text-neutral0'
                            }`}
                        >
                            {option.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export default BooleanSelect