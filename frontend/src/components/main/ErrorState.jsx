const ErrorState = ({
    title = 'Something went wrong',
    description = '',
    fullPage = false,
    className = '',
}) => {
    const layoutClass = fullPage
        ? 'w-full min-h-screen flex items-center justify-center'
        : 'w-full h-full min-h-[120px] flex items-center justify-center'

    return (
        <div className={`${layoutClass} ${className}`}>
            <div className='text-center'>
                <h2 className='text-lg font-semibold text-text1'>{title}</h2>
                {description ? (
                    <p className='mt-2 text-sm text-text2'>{description}</p>
                ) : null}
            </div>
        </div>
    )
}

export default ErrorState
