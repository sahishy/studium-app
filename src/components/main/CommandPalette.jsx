import { useEffect } from 'react'
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
    useEffect(() => {
        if(!isOpen) {
            return
        }

        const handleKeyDown = (event) => {
            if(event.key === 'Escape') {
                onClose?.()
            }
        }

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.body.style.overflow = previousOverflow
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [isOpen, onClose])

    if(!isOpen) {
        return null
    }

    return (
        <div className='fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-6'>
            <div className='w-full max-w-3xl h-[72vh] bg-neutral6 border border-neutral3 rounded-3xl shadow-2xl flex flex-col overflow-hidden'>
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