import EditCircleBannerModal from '../components/modals/EditCircleBannerModal'
import EditCircleFlairModal from '../components/modals/EditCircleFlairModal'
import { updateCircle, leaveCircle } from '../services/circleService'
import { useNavigate } from 'react-router-dom'
import Button from '../../../shared/components/ui/Button'
import { useOutletContext } from 'react-router-dom'
import { useModal } from '../../../shared/contexts/ModalContext'
import EditCircleNameModal from '../components/modals/EditCircleNameModal'
import CircleBanner from '../components/CircleBanner'
import DeleteCircleModal from '../components/modals/DeleteCircleModal'

const DetailRow = ({ label, value, action, onActionClick }) => {
    return (
        <div className='py-3'>
            <div className='flex items-start justify-between gap-6'>

                <div>
                    <p className='text-sm font-semibold text-neutral0'>{label}</p>
                    {value ? <div className='text-sm text-neutral1'>{value}</div> : null}
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
    const navigate = useNavigate()
    const isOwner = circle.createdByUserId === profile.uid
    const { openModal, closeModal } = useModal()

    return (
        <div className='w-full max-w-3xl flex flex-col gap-12 mx-auto'>

            <section className='flex flex-col gap-6 pt-12'>

                <h2 className='text-xl font-semibold text-neutral0'>Circle Details</h2>

                <div className='divide-y divide-neutral4'>
                    <DetailRow
                        label='Circle name'
                        value={circle?.profile?.title || '—'}
                        action={isOwner ? 'Edit' : null}
                        onActionClick={() => openModal(<EditCircleNameModal profile={profile} circle={circle} closeModal={closeModal} />)}
                    />
                    <DetailRow label="Banner" value={<CircleBanner banner={circle.profile.banner} className="size-16 rounded-xl text-2xl mt-2" />} action={isOwner ? 'Edit' : null} onActionClick={() => openModal(<EditCircleBannerModal banner={circle.profile.banner} onSave={banner => updateCircle(circle.uid, {'profile.banner':banner})} closeModal={closeModal} />)} />
                    <DetailRow label="Flair" value={circle.profile.flair || 'None'} action={isOwner ? 'Edit' : null} onActionClick={() => openModal(<EditCircleFlairModal circle={circle} closeModal={closeModal} />)} />
                    <DetailRow label='Invite code' value={circle?.inviteCode || '—'} />
                </div>

            </section>

            <section className='flex flex-col gap-6'>

                <h2 className='text-xl font-semibold text-neutral0'>Manage Circle</h2>

                <div className='divide-y divide-neutral4'>
                    <div className='py-3 flex items-center justify-between gap-6'>
                        <div>
                            <p className='font-semibold text-neutral0'>{isOwner ? 'Delete circle' : 'Leave circle'}</p>
                            <p className='text-sm text-neutral1'>{isOwner ? 'Permanently delete this circle.' : 'Leave this circle and its shared agenda.'}</p>
                        </div>
                        <Button
                            type='negative'
                            onClick={async () => { if(isOwner) openModal(<DeleteCircleModal circle={circle} closeModal={closeModal} />); else { await leaveCircle(profile.uid,circle.uid); navigate('/socials') } }}
                        >
                            {isOwner ? 'Delete Circle' : 'Leave Circle'}
                        </Button>
                    </div>
                </div>

            </section>

        </div>
    )

}

export default CircleSettingsTab
