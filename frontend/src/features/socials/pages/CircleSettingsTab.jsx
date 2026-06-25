import Button from '../../../shared/components/ui/Button'
import { useOutletContext } from 'react-router-dom'
import { useModal } from '../../../shared/contexts/ModalContext'
import EditCircleModal from '../components/modals/EditCircleModal'
import DeleteCircleModal from '../components/modals/DeleteCircleModal'

const DetailRow = ({ label, value, action, onActionClick }) => {
    return (
        <div className='py-3'>
            <div className='flex items-start justify-between gap-6'>

                <div>
                    <p className='text-sm font-semibold text-neutral0'>{label}</p>
                    {value ? <p className='text-sm text-neutral1'>{value}</p> : null}
                </div>
                {action && (
                    <button
                        type='button'
                        onClick={onActionClick}
                        className='text-sm font-semibold transition-colors text-neutral1 hover:text-neutral0 cursor-pointer'
                    >
                        {action}
                    </button>
                )}

            </div>
        </div>
    )
}

const CircleSettingsTab = () => {

    const { profile, circle } = useOutletContext()
    const { openModal, closeModal } = useModal()

    return (
        <div className='w-full max-w-3xl flex flex-col gap-12 mx-auto'>

            <section className='flex flex-col gap-6 pt-12'>

                <h2 className='text-xl font-semibold text-neutral0'>Circle Details</h2>

                <div className='divide-y divide-neutral4'>
                    <DetailRow
                        label='Circle name'
                        value={circle?.profile?.title || '—'}
                        action='Edit'
                        onActionClick={() => openModal(<EditCircleModal profile={profile} circle={circle} closeModal={closeModal} />)}
                    />
                    <DetailRow label='Invite code' value={circle?.inviteCode || '—'} />
                </div>

            </section>

            <section className='flex flex-col gap-6'>

                <h2 className='text-xl font-semibold text-neutral0'>Manage Circle</h2>

                <div className='divide-y divide-neutral4'>
                    <div className='py-3 flex items-center justify-between gap-6'>
                        <div>
                            <p className='font-semibold text-neutral0'>Delete circle</p>
                            <p className='text-sm text-neutral1'>Permanently delete this circle.</p>
                        </div>
                        <Button
                            type='negative'
                            onClick={() => openModal(<DeleteCircleModal circle={circle} closeModal={closeModal} />)}
                        >
                            Delete Circle
                        </Button>
                    </div>
                </div>

            </section>

        </div>
    )

}

export default CircleSettingsTab
