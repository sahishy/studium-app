import { FaCircleExclamation } from 'react-icons/fa6'
import Button from '../../../../shared/components/ui/Button'

const AddTeacherErrorModal = ({
    errorMessage = 'Invalid teacher name',
    onClose = () => { },
}) => {
    return (
        <div className='flex flex-col items-center gap-8'>
            <h1 className='text-2xl font-semibold text-center'>Invalid Teacher</h1>

            <p className='text-sm text-red-400 flex items-center gap-2'><FaCircleExclamation /> {errorMessage}</p>


            <Button type='primary' onClick={onClose} className='w-full py-4'>
                Okay
            </Button>
        </div>
    )
}

export default AddTeacherErrorModal
