import React, { createContext, useState, useContext } from 'react'
import Modal from '../components/modals/Modal'

const ModalContext = createContext()

export const useModal = () => useContext(ModalContext)

export const ModalProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [modalContent, setModalContent] = useState(null)

    const openModal = (content) => {
        setModalContent(content)
        setIsOpen(true)
    }

    const closeModal = () => {
        setIsOpen(false)
        setModalContent(null)
    }

    return (
        <ModalContext.Provider value={{ isOpen, modalContent, openModal, closeModal }}>
            {children}
            {isOpen && <Modal isOpen={isOpen} content={modalContent} closeModal={closeModal}/>}
        </ModalContext.Provider>
    )
}