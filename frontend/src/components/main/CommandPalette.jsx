import { useEffect, useState } from 'react'
import { IoSearch } from 'react-icons/io5'
import CloseButton from './CloseButton'

const CommandPalette = ({
    isOpen,
    onClose,
    query,
    onQueryChange,
    placeholder = 'Search... ',
    children
}) => {
    const [animate, setAnimate] = useState(false)

    useEffect(() => {
        if(!isOpen) {
            setAnimate(false)
            return
        }

        const timer = setTimeout(() => {
            setAnimate(true)
        }, 10)

        const handleKeyDown = (event) => {
            if(event.key === 'Escape') {
                onClose?.()
            }
        }

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            clearTimeout(timer)
            document.body.style.overflow = previousOverflow
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [isOpen, onClose])

    if(!isOpen) {
        return null
    }

    return (
        <div className={`fixed inset-0 z-50 bg-backdrop flex items-center justify-center p-6
            transition-all ${animate ? 'backdrop-blur-xs' : 'backdrop-blur-none'}`}>
            <div className={`w-full max-w-3xl h-[72vh] bg-neutral6 rounded-xl shadow-2xl
                flex flex-col overflow-hidden transition-all transform
                ${animate ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                <div className='px-6 py-4 flex items-center gap-3'>
                    <IoSearch className='text-lg text-neutral1 shrink-0'/>
                    <input
                        autoFocus
                        value={query}
                        onChange={(event) => onQueryChange?.(event.target.value)}
                        placeholder={placeholder}
                        className='flex-1 bg-transparent text-neutral0 placeholder:text-neutral1 focus:outline-none'
                    />
                        <CloseButton onClick={onClose}/>
                </div>

                <div className='flex-1 min-h-0'>
                    {children}
                </div>
            </div>
        </div>
    )
}

export default CommandPalette