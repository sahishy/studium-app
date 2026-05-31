import { useMemo, useState } from 'react';
import { createCircle } from '../../services/circleService';
import Button from '../../../../shared/components/ui/Button';
import { hasFlaggedWords } from '../../../../shared/services/censorService';
import { FaArrowRight, FaCircleExclamation } from 'react-icons/fa6';
import BooleanSelect from '../../../../shared/components/ui/BooleanSelect';
import { useModal } from '../../../../shared/contexts/ModalContext';
import EditCircleBannerModal from './EditCircleBannerModal';
import { DEFAULT_CIRCLE_BANNER } from '../../utils/circleUtils';
import CircleBanner from '../CircleBanner';
import { CIRCLE_TITLE_MAX, CIRCLE_TITLE_MIN } from '../../utils/circleUtils';

const CreateCircleModal = ( { profile, closeModal } ) => {

    const [title, setTitle] = useState(profile ? `${profile.profile.displayName}'s Circle` : 'My Circle');
    const [circleType, setCircleType] = useState('study');
    const [banner, setBanner] = useState(DEFAULT_CIRCLE_BANNER);
    const [isCreating, setIsCreating] = useState(false);
    const { openModal, closeModal: closeTopModal } = useModal();

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

    const handleCreate = async (e) => {

        e.preventDefault()

        if (!validation.isValid || isCreating) {
            return;
        }

        setIsCreating(true);

        const trimmedTitle = String(title).trim()

        const circleData = {
            type: circleType,
            profile: {
                title: trimmedTitle,
                flair: circleType === 'study' ? null : '',
                banner,
            },
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

                <div className='w-full flex justify-center mb-1'>
                    <div className='relative group/avatar'>

                        <CircleBanner
                            banner={banner}
                            onClick={() => openModal(
                                <EditCircleBannerModal
                                    banner={banner}
                                    onSave={(nextBanner) => setBanner(nextBanner)}
                                    closeModal={closeTopModal}
                                />
                            )}
                            className='w-24 h-24 rounded-2xl text-3xl'
                        />

                        <button
                            type='button'
                            onClick={() => openModal(
                                <EditCircleBannerModal
                                    banner={banner}
                                    onSave={(nextBanner) => setBanner(nextBanner)}
                                    closeModal={closeTopModal}
                                />
                            )}
                            className='absolute -bottom-1 -right-1 bg-neutral3/60 backdrop-blur-xs rounded-full p-2 opacity-0 group-hover/avatar:opacity-100 transition cursor-pointer'
                        >
                            <FaArrowRight className='text-sm group-hover/avatar:-rotate-45 transition' />
                        </button>

                    </div>
                </div>

                <div className='flex flex-col gap-2 mb-1'>

                    <p className='text-sm text-neutral1'>Circle Title</p>
                    <input
                        type="text"
                        placeholder="Title*"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full p-4 border-2 border-neutral4 rounded-xl focus:outline-gray-400"
                        required={true}
                    />

                </div>

                <div className='flex flex-col gap-2'>

                    <p className='text-sm text-neutral1'>Circle Type</p>
                    <BooleanSelect
                        leftOption={{ value: 'study', label: 'Study' }}
                        rightOption={{ value: 'competitive', label: 'Competitive' }}
                        value={circleType}
                        onChange={setCircleType}
                    />

                </div>

                {!validation.isValid && (
                    <p className='text-sm text-red-400 flex items-center gap-2'><FaCircleExclamation /> {validation.error}</p>
                )}

                {isCreating ? (
                    <p className="text-neutral2 text-center">Creating...</p>
                ) : (
                    <div className='flex gap-4 mt-4'>
                        <Button onClick={() => closeModal()} type={'secondary'} className={'w-full py-4'}>
                            Cancel
                        </Button>

                        <Button htmlType={'submit'} type={'primary'} className={'w-full py-4'} disabled={!validation.isValid || isCreating}>
                            Create
                        </Button>
                    </div>
                )}

            </form>

        </div>

    )
}

export default CreateCircleModal