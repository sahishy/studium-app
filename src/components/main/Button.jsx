const Button = ( { children, onClick, type, htmlType='button', className, disabled=false } ) => {

    const getClass = () => {
        if(type === 'primary') {
            return 'text-text4 bg-primary0 hover:bg-primary1 border-primary1';
        } else if(type === 'secondary') {
            return 'text-text1 bg-background1 hover:bg-background5 border-border';
        } else if(type === 'negative') {
            return 'text-white bg-red-400 hover:bg-red-500 border-red-500';
        } else {
            return 'text-text1 bg-background1 hover:bg-background5 border-border';
        }
    }

    return (
        <button
            type={htmlType}
            disabled={disabled}
            onClick={onClick}
            className={`${className} flex gap-3 items-center justify-center
                ${getClass()}
                px-4 py-2 border-2 border-b-4 rounded-xl active:mt-[2px] active:border-b-2 cursor-pointer 
                
                transition-all duration-200`}
        >
            {children}
        </button>
    )
}

export default Button;