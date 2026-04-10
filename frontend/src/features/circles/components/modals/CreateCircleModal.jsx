import { useState } from 'react';
import { createCircle } from '../../services/circleService';
import Button from '../../../../shared/components/ui/Button';

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
                    className="w-full p-4 border-2 border-neutral4 rounded-xl focus:outline-gray-400"
                    required={true}
                />

                {isCreating ? (
                    <p className="text-text2 text-center">Creating...</p>
                ) : (
                    <div className='flex gap-4 mt-4'>
                        <Button onClick={() => closeModal()} type={'secondary'} className={'w-full py-4'}>
                            Cancel
                        </Button>

                        <Button htmlType={'submit'} type={'primary'} className={'w-full py-4'}>
                            Create
                        </Button>
                    </div>
                )}

            </form>

        </div>

    )
}

export default CreateCircleModal