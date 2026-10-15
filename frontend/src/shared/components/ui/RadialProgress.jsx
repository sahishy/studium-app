const RadialProgress = ({
    value = 0,
    max = 100,
    size = 96,
    thickness = 6,
    className = '',
    trackClassName = 'text-neutral5 dark:text-neutral4',
    fillClassName = 'text-sky-400',
    children,
}) => {

    const safeMax = Number(max) > 0 ? Number(max) : 1
    const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0
    const ratio = Math.max(0, Math.min(1, safeValue / safeMax))

    const radius = (size - thickness) / 2
    const circumference = 2 * Math.PI * radius

    return (
        <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>

            <svg width={size} height={size} className='absolute -rotate-90'>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill='none'
                    strokeWidth={thickness}
                    className={trackClassName}
                    stroke='currentColor'
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill='none'
                    strokeWidth={thickness}
                    strokeLinecap='round'
                    className={`${fillClassName} transition-[stroke-dashoffset] duration-700 ease-out `}
                    stroke='currentColor'
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - ratio)}
                />
            </svg>

            <div className='relative flex items-center justify-center'>
                {children}
            </div>

        </div>
    )
}

export default RadialProgress
