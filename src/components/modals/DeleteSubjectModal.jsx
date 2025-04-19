import { deleteSubject } from "../../utils/subjectUtils"
import { getColor } from "../../utils/subjectUtils";

const DeleteSubjectModal = ( { subject, closeModal } ) => {

    const handleDelete = async (e) => {

        e.preventDefault()

        deleteSubject(subject.uid);

        closeModal();

    }

    return (
        <div className='flex flex-col gap-8'>

            <h1 className='text-2xl font-semibold text-center'>
                Are you sure?
            </h1>

            <p className="text-center text-lg text-gray-600">
                Delete '
                <span className={`font-semibold ${getColor(subject.color).textStyle}`}>{subject.title}</span> 
                '? This action can not be reversed.
            </p>

            <form onSubmit={handleDelete} className="flex gap-4">

                <button 
                    type='button' 
                    onClick={() => closeModal()}
                    className='w-full p-4 border-2 border-gray-200 border-b-4 rounded-lg hover:bg-gray-800/5 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                >
                    Cancel
                </button>

                <button 
                    type='submit' 
                    className='w-full p-4 text-white border-red-500 border-b-4 rounded-lg bg-red-400 hover:bg-red-500 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                >
                    Delete
                </button>

            </form>

        </div>

    )
}

export default DeleteSubjectModal