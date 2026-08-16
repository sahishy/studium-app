import { useState } from 'react'
import { FaCircleExclamation } from 'react-icons/fa6'
import Button from '../../../../shared/components/ui/Button'

const JoinPartyModal = ({ onJoin, closeModal }) => {
    const [partyCode, setPartyCode] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async (event) => {
        event.preventDefault()
        setError('')
        const normalizedCode = partyCode.trim()
        if(!normalizedCode) {
            setError('Enter a party code.')
            return
        }

        setSubmitting(true)
        try {
            await onJoin(normalizedCode)
            closeModal()
        } catch(err) {
            setError(err?.message ?? 'Unable to join that party.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className='flex flex-col gap-6'>
            <div className='text-center'>
                <h1 className='text-2xl font-semibold'>Join a Party</h1>
                <p className='text-sm text-neutral1 mt-1'>Enter a friend&apos;s party code to join them.</p>
            </div>
            <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
                <input
                    autoFocus
                    type='text'
                    value={partyCode}
                    onChange={(event) => setPartyCode(event.target.value)}
                    placeholder='Enter party code'
                    className='w-full border-2 border-neutral4 rounded-xl p-4 outline-none focus:border-neutral2 transition'
                    required
                />
                {error ? <p className='flex items-center gap-2 text-sm text-red-400'><FaCircleExclamation /> {error}</p> : null}
                <div className='flex gap-4 mt-2'>
                    <Button type='secondary' className='w-full py-4' onClick={closeModal}>Cancel</Button>
                    <Button htmlType='submit' type='primary' className='w-full py-4' disabled={submitting} loading={submitting}>Join</Button>
                </div>
            </form>
        </div>
    )
}

export default JoinPartyModal
