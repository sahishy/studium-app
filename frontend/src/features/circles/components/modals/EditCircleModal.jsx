import { useState } from 'react';
import { updateCircle } from '../../services/circleService';
import Button from '../../../../shared/components/ui/Button';

const EditCircleModal = ( { profile, circle, closeModal } ) => {

    const [title, setTitle] = useState(circle.title);

    const handleEdit = async (e) => {

        e.preventDefault()

        const circleData = {
            title: title,
        }

        updateCircle(circle.uid, circleData);

        closeModal();

    }

    return (
        <div className='flex flex-col gap-8'>

            <h1 className='text-2xl font-semibold text-center'>
                Edit Circle
            </h1>

            <form onSubmit={handleEdit} className="flex flex-col gap-4">

                <input
                    type="text"
                    placeholder="Title*"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-4 border-2 border-neutral4 rounded-xl focus:outline-gray-600"
                    required={true}
                />

                <div className='flex gap-4 mt-4'>
                    <Button onClick={() => closeModal()} type={'secondary'} className={'w-full py-4'}>
                        Cancel
                    </Button>

                    <Button htmlType={'submit'} type={'primary'} className={'w-full py-4'}>
                        Save Changes
                    </Button>
                </div>

            </form>

        </div>

    )
}

export default EditCircleModal