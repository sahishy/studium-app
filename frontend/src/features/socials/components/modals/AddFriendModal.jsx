import { useState } from 'react'
import Button from '../../../../shared/components/ui/Button'
import { sendFriendRequestByUsername } from '../../services/friendService'
import { FaCircleExclamation } from 'react-icons/fa6'

const AddFriendModal = ({ profile, closeModal }) => {

    const [username, setUsername] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setSubmitting(true)

        try {
            await sendFriendRequestByUsername(profile?.uid, username)
            closeModal()
        } catch(err) {
            setError(err?.message ?? 'Unable to send friend request.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className='flex flex-col gap-6'>
            <h1 className='text-2xl font-semibold text-center'>Add Friend</h1>

            <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
                <input
                    type='text'
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder='Enter username'
                    className='w-full border-2 border-neutral4 rounded-xl p-3 text-sm'
                    required
                />

                {error && <p className='flex items-center gap-2 text-sm text-red-400'><FaCircleExclamation /> {error}</p>}

                <div className='flex gap-4 mt-2'>
                    <Button type='secondary' className='w-full py-4' onClick={closeModal}>
                        Cancel
                    </Button>
                    <Button htmlType='submit' type='primary' className='w-full py-4' disabled={submitting}>
                        {submitting ? 'Sending...' : 'Send Request'}
                    </Button>
                </div>
            </form>
        </div>
    )
    
}

export default AddFriendModal
