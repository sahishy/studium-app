import { createContext, useState, useContext } from 'react'
import Modal from '../components/modals/Modal'

const ModalContext = createContext()

export const useModal = () => useContext(ModalContext)

export const ModalProvider = ({ children }) => {
    const [modalStack, setModalStack] = useState([])

    const openModal = (content) => {
        const modalId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        setModalStack((previous) => [...previous, { id: modalId, content }])
        return modalId
    }

    const closeModalById = (modalId) => {
        setModalStack((previous) => previous.filter((modalEntry) => modalEntry.id !== modalId))
    }

    const closeModal = () => {
        setModalStack((previous) => previous.slice(0, -1))
    }

    const isOpen = modalStack.length > 0
    const modalContent = modalStack[modalStack.length - 1]?.content ?? null

    return (
        <ModalContext.Provider value={{ isOpen, modalContent, openModal, closeModal, closeModalById, modalStack }}>
            {children}
            {modalStack.map((modalEntry) => (
                <Modal
                    key={modalEntry.id}
                    isOpen={true}
                    modalContent={modalEntry.content}
                    closeModal={() => closeModalById(modalEntry.id)}
                />
            ))}
        </ModalContext.Provider>
    )
}