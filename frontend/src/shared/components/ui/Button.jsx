const Button = ( {
    children,
    onClick,
    type = 'secondary',
    htmlType = 'button',
    className = '',
    disabled = false,
    ...props
} ) => {

    const getClass = () => {
        if(type === 'primary') {
            return 'text-neutral6 bg-neutral0 border border-slate-900 not-disabled:hover:opacity-90 border-b-4 not-disabled:active:border-b-1 not-disabled:active:mt-[3.2px]';
        } else if(type === 'secondary') {
            return 'text-neutral0 bg-neutral6 border border-neutral4 not-disabled:hover:bg-neutral5 border-b-4 not-disabled:active:border-b-1 not-disabled:active:mt-[3.2px]';
        } else if(type === 'tertiary') {
            return 'text-neutral0 bg-neutral3/60 backdrop-blur-xs not-disabled:hover:bg-neutral3';
        } else if(type === 'negative') {
            return 'text-white bg-red-400 border border-red-500 not-disabled:hover:bg-red-500 border-b-4 not-disabled:active:border-b-1 not-disabled:active:mt-[3.2px]';
        } else {
            return 'text-neutral0';
        }
    }

    return (
        <button
            type={htmlType}
            disabled={disabled}
            onClick={onClick}
            {...props}
            className={`${className} flex gap-3 items-center justify-center
                text-sm font-semibold
                ${getClass()}
                px-4 py-2 rounded-2xl cursor-pointer
                disabled:opacity-60 disabled:cursor-not-allowed transition-all`}
        >
            {children}
        </button>
    )
}

export default Button;