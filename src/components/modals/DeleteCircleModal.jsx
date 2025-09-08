import { useState } from "react";
import { getFirestore, writeBatch, doc } from 'firebase/firestore';
import { useCircleTasks }    from '../../utils/taskUtils.jsx';
import { useCircleSubjects } from '../../utils/subjectUtils.jsx'
import { useNavigate } from "react-router-dom";
import Button from "../../pages/main/Button.jsx";

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

            <p className="text-center text-lg text-text1">
                Delete '
                <span className={`font-semibold`}>{circle.title}</span> 
                '? This action can not be reversed.
            </p>

            {isDeleting ? (
                <p className="text-text2 text-center">Deleting...</p>
            ) : (
                <form onSubmit={handleDelete} className="flex gap-4">
                    <Button onClick={() => closeModal()} type={'secondary'} className={'w-full py-4'}>
                        Cancel
                    </Button>

                    <Button htmlType={'submit'} type={'negative'} className={'w-full py-4'}>
                        Delete
                    </Button>
                </form>                
            )}



        </div>

    )
}

export default DeleteCircleModal