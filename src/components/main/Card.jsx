const Card = ( { hoverable, className, children } ) => {
    return (
        <div
            className={`flex flex-col gap-4 p-4 bg-background1 rounded-xl border-2 border-border shadow-lg shadow-shadow min-w-0 
                ${hoverable && 'group hover:bg-background5 transition-colors cursor-pointer duration-200'}
                ${className}`}
        >
            {children}
        </div>
    )
}

export default Card