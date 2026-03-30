import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useModal } from '../../contexts/ModalContext'

import CloseButton from '../main/CloseButton';

const Modal = ({ isOpen, closeModal }) => {

    const { modalContent } = useModal()
    const [animate, setAnimate] = useState(false);

    useEffect(() => {

        document.body.style.overflow = 'hidden'

        return () => {
            document.body.style.overflow = 'auto'
        }

    }, [])

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

    return createPortal(
        <div className={`fixed inset-0 bg-backdrop flex justify-center items-center z-50
         transition-all  ${animate ? 'backdrop-blur-xs' : 'backdrop-blur-none'}`}>
            <div 
                className={`bg-background0 p-8 rounded-xl max-w-lg w-full
                    transition-all  transform
                    ${animate ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
            >
                <div className='relative pt-8'>

                    <CloseButton onClick={closeModal} className='absolute top-0 right-0'/>

                    {modalContent}
                </div>

            </div>
        </div>,
        document.getElementById('modal-root')
    )

}

export default Modal