import { FaSliders } from 'react-icons/fa6'
import { useModal } from '../../../shared/contexts/ModalContext'
import ViewPreferencesModal from './ViewPreferencesModal'

const ViewOptionsButton = ({ preferences, onSave }) => {
    const { openModal, closeModal } = useModal()

    return (
        <button
            type='button'
            onClick={() => openModal({
                content: <ViewPreferencesModal preferences={preferences} onSave={onSave} closeModal={closeModal} />,
                maxWidthClass: 'max-w-xl mx-4',
            })}
            className='flex h-11 items-center gap-2 rounded-full border border-neutral4 px-4 text-sm font-semibold text-neutral0 transition-colors hover:bg-neutral5 focus-visible:outline-2 focus-visible:outline-offset-2'
        >
            <FaSliders className='text-xs' />
            <span className='hidden sm:inline'>Options</span>
        </button>
    )
}

export default ViewOptionsButton
