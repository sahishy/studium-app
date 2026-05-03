import { FaArrowRight } from "react-icons/fa6"
import { forwardRef } from 'react'

const Card = forwardRef(( { hoverable, className, children, ...props }, ref ) => {
    return (
        <div
            ref={ref}
            {...props}
            className={`relative flex flex-col gap-4 p-4 bg-neutral6 dark:bg-neutral5 rounded-xl border border-neutral4 shadow-lg shadow-shadow min-w-0 
                ${hoverable && 'group/card cursor-pointer'}
                ${className}`}
        >
            {children}
            <div className={`absolute right-4 bottom-4 bg-neutral3/60 backdrop-blur-xs rounded-full p-2
                group-hover/card:opacity-100 group-hover/card:translate-x-0  opacity-0 -translate-x-1 transition
                ${!hoverable && 'pointer-events-none'}
            `}
            >
                <FaArrowRight className="text-neutral0 text-sm"/>
            </div>
        </div>
    )
})

export default Card