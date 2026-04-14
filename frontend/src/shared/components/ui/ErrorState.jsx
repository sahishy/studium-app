import { FaFrown } from "react-icons/fa"

const ErrorState = ({ title = 'Something went wrong', description = '', fullPage = false, className = '' }) => {

    const layoutClass = fullPage
        ? 'w-full min-h-screen flex items-center justify-center'
        : 'w-full h-full min-h-[120px] flex items-center justify-center'

    return (
        <div className={`${layoutClass} ${className}`}>
            <div className='flex flex-col items-center text-center'>
                <FaFrown className="text-neutral2 text-4xl mb-3"/>
                <h2 className='text-lg font-semibold text-neutral0'>{title}</h2>
                {description ? (
                    <p className='mt-2 text-sm text-neutral1 max-w-2xl text-wrap'>{description}</p>
                ) : null}
            </div>
        </div>
    )
    
}

export default ErrorState
