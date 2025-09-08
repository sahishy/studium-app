import Button from "../../pages/main/Button";
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

            <p className="text-center text-lg text-text1">
                Delete '
                <span className={`font-semibold ${getColor(subject.color).textStyle}`}>{subject.title}</span> 
                '? This action can not be reversed.
            </p>

            <form onSubmit={handleDelete} className="flex gap-4">
                <Button onClick={() => closeModal()} type={'secondary'} className={'w-full py-4'}>
                    Cancel
                </Button>

                <Button htmlType={'submit'} type={'negative'} className={'w-full py-4'}>
                    Delete
                </Button>
            </form>

        </div>

    )
}

export default DeleteSubjectModal