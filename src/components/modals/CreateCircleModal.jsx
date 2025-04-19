import { useState } from 'react';
import { createCircle } from '../../utils/circleUtils';

const CreateCircleModal = ( { profile, closeModal } ) => {

    const [title, setTitle] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async (e) => {

        e.preventDefault()

        setIsCreating(true);

        const circleData = {
            title: title,
        }

        await createCircle(profile.uid, circleData);

        closeModal();

    }

    return (
        <div className='flex flex-col gap-8'>

            <h1 className='text-2xl font-semibold text-center'>
                Create Circle
            </h1>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">

                <input
                    type="text"
                    placeholder="Title*"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-4 border-2 border-gray-200 rounded-lg focus:outline-gray-600"
                    required={true}
                />

                {isCreating ? (
                    <p className="text-gray-400 text-center">Creating...</p>
                ) : (
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
                            Create
                        </button>
                    </div>
                )}

            </form>

        </div>

    )
}

export default CreateCircleModal