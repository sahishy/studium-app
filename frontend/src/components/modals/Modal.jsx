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

import CloseButton from '../main/CloseButton';

const Modal = ({ isOpen, closeModal, modalContent }) => {
    const [animate, setAnimate] = useState(false);
    const [windowLayer, setWindowLayer] = useState(null)
    const [isTopmostLayer, setIsTopmostLayer] = useState(true)

    useEffect(() => {
        if(!isOpen) {
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

    }, [isOpen])

    useEffect(() => {

        if(isOpen) {
            const timer = setTimeout(() => {
                setAnimate(true);
            }, 10);

            return () => clearTimeout(timer);
        } else {
            setAnimate(false);
        }

    }, [isOpen]);

    const zIndex = 1000 + ((windowLayer ?? 1) * 10)
    const windowRoot = getWindowRoot()

    if(!windowRoot) {
        return null
    }

    return createPortal(
        <div className={`fixed inset-0 flex justify-center items-center z-50 transition-all ${isTopmostLayer ? 'bg-backdrop' : 'bg-transparent'} ${animate && isTopmostLayer ? 'backdrop-blur-xs' : 'backdrop-blur-none'}`} style={{ zIndex }}>
            <div 
                className={`bg-background0 p-8 rounded-xl max-w-lg w-full
                    transition-all transform will-change-transform will-change-opacity
                    ${animate ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
            >
                <div className='relative pt-8'>

                    <CloseButton onClick={closeModal} className='absolute top-0 right-0'/>

                    {modalContent}
                </div>

            </div>
        </div>,
        windowRoot
    )

}

export default Modal