const TextToast = ({ title = 'Notification', message = '', tone = 'default' }) => {

    const toneClass = tone === 'success'
        ? 'text-green-500'
        : tone === 'warning'
            ? 'text-amber-500'
            : 'text-text2'

    return (
        <div className='flex flex-col gap-1'>
            <p className='text-sm font-semibold'>{title}</p>
            {message ? (
                <p className={`text-sm ${toneClass}`}>{message}</p>
            ) : null}
        </div>
    )
}

export default TextToast
