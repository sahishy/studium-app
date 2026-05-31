import { FaEdit } from 'react-icons/fa'
import Button from '../../../../shared/components/ui/Button'

const EditDisplayNameOrFlairModal = ({ closeModal, onOpenDisplayName, onOpenFlair }) => {

    const handleOpenDisplayName = () => {
        onOpenDisplayName?.()
    }

    const handleOpenFlair = () => {
        onOpenFlair?.()
    }

    return (
        <div className='flex flex-col gap-8'>
            <h1 className='text-2xl font-semibold text-center'>Edit Profile</h1>

            <div className='divide-y divide-neutral4'>
                <div className='py-3'>
                    <div className='flex items-start justify-between gap-6'>
                        <div>
                            <p className='text-sm font-semibold text-neutral0'>Display name</p>
                            <p className='text-sm text-neutral1'>A unique name shown on your profile.</p>
                        </div>

                        <button
                            type='button'
                            onClick={handleOpenDisplayName}
                            className='p-2 rounded-lg text-neutral1 hover:text-neutral0 hover:bg-neutral5 transition cursor-pointer'
                        >
                            <FaEdit />
                        </button>
                    </div>
                </div>

                <div className='py-3'>
                    <div className='flex items-center justify-between gap-6'>

                        <div>
                            <p className='text-sm font-semibold text-neutral0'>Flair</p>
                            <p className='text-sm text-neutral1'>Show off a stat next to your display name.</p>
                        </div>

                        <button
                            type='button'
                            onClick={handleOpenFlair}
                            className='p-2 rounded-lg text-neutral1 hover:text-neutral0 hover:bg-neutral5 transition cursor-pointer'
                        >
                            <FaEdit />
                        </button>

                    </div>
                </div>
            </div>

            <Button type='primary' onClick={closeModal} className='w-full py-4'>Done</Button>
        </div>
    )

}

export default EditDisplayNameOrFlairModal