import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
    allocateWindowLayer,
    getWindowRoot,
    isTopWindowLayer,
    lockBodyScroll,
    releaseWindowLayer,
    subscribeWindowLayerChanges,
    unlockBodyScroll,
} from '../../utils/windowLayerUtils'

import CloseButton from '../ui/CloseButton';
import { ModalVisibilityContext } from '../../contexts/ModalVisibilityContext.jsx'

const Modal = ({ isOpen, closeModal, modalContent, maxWidthClass = 'max-w-lg' }) => {
    const [animate, setAnimate] = useState(false);
    const [windowLayer, setWindowLayer] = useState(null)
    const [isTopmostLayer, setIsTopmostLayer] = useState(true)
    const [hidden, setHidden] = useState(false)

    useEffect(() => {
        if(!isOpen || hidden) {
            return
        }

        const nextLayer = allocateWindowLayer()
        setWindowLayer(nextLayer)
        setIsTopmostLayer(isTopWindowLayer(nextLayer))

        const unsubscribeLayerChanges = subscribeWindowLayerChanges(() => {
            setIsTopmostLayer(isTopWindowLayer(nextLayer))
        })

        lockBodyScroll()

        return () => {
            unsubscribeLayerChanges()
            releaseWindowLayer(nextLayer)
            unlockBodyScroll()
        }

    }, [isOpen, hidden])

    useEffect(() => {

        if(isOpen && !hidden) {
            const timer = setTimeout(() => {
                setAnimate(true);
            }, 10);

            return () => clearTimeout(timer);
        } else {
            setAnimate(false);
        }

    }, [isOpen, hidden]);

    const zIndex = 1000 + ((windowLayer ?? 1) * 10)
    const windowRoot = getWindowRoot()

    if(!windowRoot) {
        return null
    }

    return createPortal(
        <div className={`fixed inset-0 flex justify-center items-center z-50 transition-all ${isTopmostLayer ? 'bg-backdrop' : 'bg-transparent'} ${animate && isTopmostLayer ? 'backdrop-blur-xs' : 'backdrop-blur-none'}`} style={{ zIndex, display: hidden ? 'none' : undefined }}>
            <div
                role="dialog" aria-modal="true" aria-label="Account dialog"
                className={`bg-neutral6 p-8 rounded-xl w-full ${maxWidthClass}
                    transition-all transform will-change-transform will-change-opacity
                    ${animate ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
            >
                <div className='relative pt-8'>

                    <CloseButton onClick={closeModal} className='absolute top-0 right-0'/>

                    <ModalVisibilityContext.Provider value={setHidden}>
                        {modalContent}
                    </ModalVisibilityContext.Provider>
                </div>

            </div>
        </div>,
        windowRoot
    )

}

export default Modal
