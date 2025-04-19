import { useState } from 'react';
import { getColors } from '../../utils/subjectUtils';
import { updateCircle } from '../../utils/circleUtils';

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
                    className="w-full p-4 border-2 border-gray-200 rounded-lg focus:outline-gray-600"
                    required={true}
                />

                <div className='flex gap-4 mt-4'>
                    <button
                        type='button' 
                        onClick={() => closeModal()}
                        className='w-full p-4 border-2 border-gray-200 border-b-4 rounded-lg hover:bg-gray-800/5 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                    >
                        Cancel
                    </button>

                    <button 
                        type='submit' 
                        className='w-full p-4 text-white border-black border-b-4 rounded-lg bg-gray-800 hover:bg-black active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                    >
                        Save Changes
                    </button>
                </div>

            </form>

        </div>

    )
}

export default EditCircleModal