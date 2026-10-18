const ChoiceCard = ({ icon, title, description, selected = false, onClick, className = '' }) => {

    return (
        <button
            type='button'
            onClick={onClick}
            className={`group flex items-center gap-4 w-full p-4 rounded-2xl text-left cursor-pointer
                border transition-all
                ${selected
                    ? 'bg-neutral5 border-neutral3 shadow-md shadow-shadow'
                    : 'bg-neutral6 dark:bg-neutral5/40 border-neutral4 hover:bg-neutral5 hover:border-neutral3'}
                ${className}`}
        >
            {icon ? (
                <div className={`shrink-0 p-3 rounded-xl text-lg transition-colors
                    ${selected ? 'bg-sky-500/15 text-sky-500' : 'bg-neutral5 text-neutral1'}`}
                >
                    {icon}
                </div>
            ) : null}

            <div className='min-w-0 flex flex-col gap-0.5'>
                <p className='text-sm font-semibold text-neutral0'>{title}</p>
                {description ? (
                    <p className='text-xs text-neutral1'>{description}</p>
                ) : null}
            </div>
        </button>
    )
}

export default ChoiceCard
