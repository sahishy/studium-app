const LoadingState = ({
    label = 'Loading...',
    fullPage = false,
    className = '',
}) => {
    const layoutClass = fullPage
        ? 'w-full min-h-screen flex items-center justify-center'
        : 'w-full h-full min-h-[120px] flex items-center justify-center'

    return (
        <div className={`${layoutClass} ${className}`}>
            <div className='flex items-center gap-3 text-text1'>
                <span className='h-4 w-4 animate-spin rounded-full border-2 border-neutral3 border-t-text1' />
                <p className='text-sm font-semibold'>{label}</p>
            </div>
        </div>
    )
}

export default LoadingState
