const ProgressBar = ({
    value = 0,
    max = 100,
    secondaryValue = null,
    secondaryMax = null,
    className = '',
    trackClassName = '',
    secondaryClassName = '',
    fillClassName = '',
    fillStyle,
}) => {

    const safeMax = Number(max) > 0 ? Number(max) : 1
    const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0
    const width = Math.max(0, Math.min(100, (safeValue / safeMax) * 100))

    const hasSecondary = secondaryValue != null
    const safeSecondaryMax = Number(secondaryMax) > 0 ? Number(secondaryMax) : safeMax
    const safeSecondaryValue = Number.isFinite(Number(secondaryValue)) ? Number(secondaryValue) : 0
    const secondaryWidth = Math.max(0, Math.min(100, (safeSecondaryValue / safeSecondaryMax) * 100))

    return (
        <div className={`relative w-full h-4 rounded-full overflow-hidden bg-neutral5 dark:bg-neutral4 ${trackClassName} ${className}`}>
            {hasSecondary ? (
                <div
                    className={`absolute left-0 top-0 h-full rounded-full bg-sky-300/35 ${secondaryClassName}`}
                    style={{ width: `${secondaryWidth}%` }}
                />
            ) : null}

            <div
                className={`relative h-full rounded-full transition-all duration-1000 bg-sky-400 ${fillClassName}`}
                style={{ width: `${width}%`, ...fillStyle }}
            >
                <div className={`h-[30%] translate-y-[3px] mx-[3px] rounded-full bg-white/30`} />
            </div>
        </div>
    )
}

export default ProgressBar
