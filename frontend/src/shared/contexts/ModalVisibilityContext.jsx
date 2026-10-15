import { createContext, useContext } from 'react'

export const ModalVisibilityContext = createContext(() => {})
export const useModalVisibility = () => useContext(ModalVisibilityContext)
