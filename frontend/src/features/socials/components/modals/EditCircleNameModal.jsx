import { useMemo, useState } from 'react';
import { updateCircle } from '../../services/circleService';
import Button from '../../../../shared/components/ui/Button';
import { hasFlaggedWords } from '../../../../shared/services/censorService';
import { FaCircleExclamation } from 'react-icons/fa6';
import { CIRCLE_TITLE_MAX, CIRCLE_TITLE_MIN } from '../../utils/circleUtils';

const EditCircleNameModal = ( { circle, closeModal } ) => {

    const [busy,setBusy] = useState(false);
    const [error,setError] = useState('');
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

        if (!validation.isValid || busy) {
            return;
        }

        const circleData = {
            'profile.title': String(title).trim(),
        }

        setBusy(true);
        try { await updateCircle(circle.uid, circleData); closeModal(); }
        catch (err) { setError(err.message); }
        finally { setBusy(false); }

    }

    return (
        <div className='flex flex-col gap-8'>

            <h1 className='text-2xl font-semibold text-center'>
                Edit Circle Name
            </h1>

            <form onSubmit={handleEdit} className="flex flex-col gap-4">

                <label htmlFor="circle-name" className="text-sm text-neutral1">Circle Title</label>
                <input
                    id="circle-name"
                    type="text"
                    placeholder="Title*"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-4 border-2 border-neutral4 rounded-xl focus:outline-gray-400"
                    required={true}
                />

                {error && <p role='alert' className='text-sm text-red-400'>{error}</p>}
                {!validation.isValid ? (
                    <p className='text-sm text-red-400 flex items-center gap-2'><FaCircleExclamation /> {validation.error}</p>
                ) : null}

                <div className='flex gap-4 mt-4'>
                    <Button onClick={() => closeModal()} type={'secondary'} className={'w-full py-4'} disabled={busy}>
                        Cancel
                    </Button>

                    <Button htmlType={'submit'} type={'primary'} className={'w-full py-4'} disabled={!validation.isValid || busy} loading={busy}>
                        Save Changes
                    </Button>
                </div>

            </form>

        </div>

    )
}

export default EditCircleNameModal