import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoSearch } from 'react-icons/io5'
import CloseButton from '../ui/CloseButton'
import {
    allocateWindowLayer,
    getWindowRoot,
    isTopWindowLayer,
    lockBodyScroll,
    releaseWindowLayer,
    subscribeWindowLayerChanges,
    unlockBodyScroll,
} from '../../utils/windowLayerUtils'

const BaseCommandPalette = ({
    isOpen,
    onClose,
    query,
    onQueryChange,
    placeholder = 'Search... ',
    children,
    emptyState = null,
    footer = null,
    maxWidthClass = 'max-w-3xl',
}) => {
    const [animate, setAnimate] = useState(false)
    const [windowLayer, setWindowLayer] = useState(null)
    const [isTopmostLayer, setIsTopmostLayer] = useState(true)

    useEffect(() => {
        if(!isOpen) {
            setAnimate(false)
            return
        }

        const nextLayer = allocateWindowLayer()
        setWindowLayer(nextLayer)
        setIsTopmostLayer(isTopWindowLayer(nextLayer))

        const unsubscribeLayerChanges = subscribeWindowLayerChanges(() => {
            setIsTopmostLayer(isTopWindowLayer(nextLayer))
        })

        const timer = setTimeout(() => {
            setAnimate(true)
        }, 10)

        const handleKeyDown = (event) => {
            if(event.key === 'Escape') {
                onClose?.()
            }
        }

        lockBodyScroll()
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            clearTimeout(timer)
            unsubscribeLayerChanges()
            releaseWindowLayer(nextLayer)
            unlockBodyScroll()
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [isOpen, onClose])

    if(!isOpen) {
        return null
    }

    const zIndex = 1000 + ((windowLayer ?? 1) * 10)
    const windowRoot = getWindowRoot()

    if(!windowRoot) {
        return null
    }

    return createPortal((
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-6 transition-all ${isTopmostLayer ? 'bg-backdrop' : 'bg-transparent'} ${animate && isTopmostLayer ? 'backdrop-blur-xs' : 'backdrop-blur-none'}`} style={{ zIndex }}>
            <div className={`w-full ${maxWidthClass} h-[72vh] bg-neutral6 rounded-xl shadow-2xl
                flex flex-col overflow-hidden transition-all transform will-change-transform will-change-opacity
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
                    {children ?? emptyState}
                </div>

                {footer ? (
                    <div className='px-4 py-3 border-t border-neutral4 bg-neutral6'>
                        {footer}
                    </div>
                ) : null}
            </div>
        </div>
    ), windowRoot)
}

export default BaseCommandPalette