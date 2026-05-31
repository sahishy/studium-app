import { useMemo, useState } from 'react';
import { updateCircle } from '../../services/circleService';
import Button from '../../../../shared/components/ui/Button';
import { hasFlaggedWords } from '../../../../shared/services/censorService';
import { FaCircleExclamation } from 'react-icons/fa6';
import { CIRCLE_TITLE_MAX, CIRCLE_TITLE_MIN } from '../../utils/circleUtils';

const EditCircleModal = ( { profile, circle, closeModal } ) => {

    const [title, setTitle] = useState(circle.profile.title);

    const validation = useMemo(() => {
        const trimmedTitle = String(title ?? '').trim();

        if (trimmedTitle.length < CIRCLE_TITLE_MIN) {
            return {
                isValid: false,
                error: `Circle name must be between ${CIRCLE_TITLE_MIN} and ${CIRCLE_TITLE_MAX} characters.`,
            };
        }

        if (trimmedTitle.length > CIRCLE_TITLE_MAX) {
            return {
                isValid: false,
                error: `Circle name must be between ${CIRCLE_TITLE_MIN} and ${CIRCLE_TITLE_MAX} characters.`,
            };
        }

        if (trimmedTitle && hasFlaggedWords(trimmedTitle)) {
            return {
                isValid: false,
                error: 'Inappropriate name.',
            };
        }

        return { isValid: true, error: '' };
    }, [title]);

    const handleEdit = async (e) => {

        e.preventDefault()

        if (!validation.isValid) {
            return;
        }

        const circleData = {
            'profile.title': String(title).trim(),
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

                {!validation.isValid ? (
                    <p className='text-sm text-red-400 flex items-center gap-2'><FaCircleExclamation /> {validation.error}</p>
                ) : null}

                <div className='flex gap-4 mt-4'>
                    <Button onClick={() => closeModal()} type={'secondary'} className={'w-full py-4'}>
                        Cancel
                    </Button>

                    <Button htmlType={'submit'} type={'primary'} className={'w-full py-4'} disabled={!validation.isValid}>
                        Save Changes
                    </Button>
                </div>

            </form>

        </div>

    )
}

export default EditCircleModal