const Button = ( {
    children,
    onClick,
    type,
    htmlType = 'button',
    className = '',
    disabled = false,
    ...props
} ) => {

    const getClass = () => {
        if(type === 'primary') {
            return 'text-neutral6 bg-neutral0 hover:opacity-90';
        } else if(type === 'secondary') {
            return 'text-neutral0 bg-neutral6 border border-neutral4 hover:bg-neutral5';
        } else if(type === 'tertiary') {
            return 'text-neutral0 bg-neutral5 hover:bg-neutral4';
        } else if(type === 'negative') {
            return 'text-white bg-red-400 hover:bg-red-500 border-red-500';
        } else {
            return 'text-neutral0 bg-neutral5';
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
                px-4 py-2 rounded-full cursor-pointer 
                transition-all `}
        >
            {children}
        </button>
    )
}

export default Button;