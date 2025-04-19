import { useState } from "react";
import { getFirestore, writeBatch, doc } from 'firebase/firestore';
import { useCircleTasks }    from '../../utils/taskUtils.jsx';
import { useCircleSubjects } from '../../utils/subjectUtils.jsx'
import { useNavigate } from "react-router-dom";

const DeleteCircleModal = ( { circle, closeModal } ) => {

    const tasks = useCircleTasks([circle.uid]);
    const subjects = useCircleSubjects([circle.uid]);
    const navigate = useNavigate()
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async (e) => {

        e.preventDefault()

        if(isDeleting) {
            return
        }

        setIsDeleting(true);
    
        const db = getFirestore();
        const batch = writeBatch(db);
        tasks.forEach(task => {
            const ref = doc(db, 'tasks', task.uid);
            batch.delete(ref);
        })
        subjects.forEach(subject => {
            const ref = doc(db, 'subjects', subject.uid);
            batch.delete(ref);
        })
        batch.delete(doc(db, 'circles', circle.uid));
        await batch.commit();
    
        closeModal();
        navigate('/circles')
    }

    return (
        <div className='flex flex-col gap-8'>

            <h1 className='text-2xl font-semibold text-center'>
                Are you sure?
            </h1>

            <p className="text-center text-lg text-gray-600">
                Delete '
                <span className={`font-semibold`}>{circle.title}</span> 
                '? This action can not be reversed.
            </p>

            {isDeleting ? (
                <p className="text-gray-400 text-center">Deleting...</p>
            ) : (
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
            )}



        </div>

    )
}

export default DeleteCircleModal