import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useModal } from '../../contexts/ModalContext'

import { IoClose } from "react-icons/io5";

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
        <div className={`fixed inset-0 bg-gray-800/20 flex justify-center items-center z-50
         transition-all duration-200 ${animate ? 'backdrop-blur-xs' : 'backdrop-blur-none'}`}>
            <div 
                className={`bg-white p-8 rounded-lg max-w-lg w-full
                    transition-all duration-200 transform
                    ${animate ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
            >
                <div className='relative pt-8'>

                    <button
                        onClick={closeModal}
                        className="absolute top-0 right-0 p-2 border-2 border-gray-200 border-b-4 rounded-lg hover:bg-gray-800/5 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200"
                    >
                        <IoClose className="text-2xl"/>
                    </button>

                    {modalContent}
                </div>

            </div>
        </div>,
        document.getElementById('modal-root')
    )

}

export default Modal