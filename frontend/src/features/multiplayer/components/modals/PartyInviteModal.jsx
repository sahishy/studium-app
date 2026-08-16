import { useState } from 'react'
import { FaCircleExclamation } from 'react-icons/fa6'
import AvatarPicture from '../../../../shared/components/avatar/AvatarPicture'
import Button from '../../../../shared/components/ui/Button'
import { getUserByDisplayName } from '../../../auth/services/userService'

const PartyInviteModal = ({ currentUserId, memberIds = [], pendingInviteUserIds = [], friends = [], onInvite, closeModal }) => {
    const [username, setUsername] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [invitedUserIds, setInvitedUserIds] = useState([])
    const onlineFriends = friends.filter((friend) => (
        friend.status === 'active' && friend.uid !== currentUserId && !memberIds.includes(friend.uid)
    ))
    const normalizedUsername = username.trim().replace(/^@/, '').toLowerCase()
    const isValidUsernameLength = normalizedUsername.length >= 3 && normalizedUsername.length <= 23
    const usernameHasPendingInvite = onlineFriends.some((friend) => (
        pendingInviteUserIds.includes(friend.uid)
        && (friend?.profile?.displayName ?? '').toLowerCase() === normalizedUsername
    ))

    const inviteUser = async (userId, closeAfterInvite = false) => {
        if (invitedUserIds.includes(userId)) return
        setError('')
        setSubmitting(true)
        try {
            await onInvite(userId)
            setInvitedUserIds((ids) => [...ids, userId])
            if (closeAfterInvite) closeModal()
        } catch (err) {
            setError(err?.message ?? 'Unable to send the party invitation.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        setError('')
        setSubmitting(true)
        try {
            const usernameToInvite = username.trim().replace(/^@/, '')
            if (!usernameToInvite) throw new Error('Enter a username.')
            if (usernameHasPendingInvite) throw new Error('That player already has a pending party invitation.')
            const targetUser = await getUserByDisplayName(usernameToInvite)
            if (!targetUser) throw new Error('No player found with that username.')
            if (targetUser.uid === currentUserId) throw new Error('You are already in this party.')
            if (memberIds.includes(targetUser.uid)) throw new Error('That player is already in this party.')
            await inviteUser(targetUser.uid, true)
        } catch (err) {
            setError(err?.message ?? 'Unable to send the party invitation.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className='flex flex-col gap-6'>
            <div className='text-center'>
                <h1 className='text-2xl font-semibold'>Invite to Party</h1>
                <p className='text-sm text-neutral1 mt-1'>Invite a player by their Studium username.</p>
            </div>
            <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
                <input
                    autoFocus
                    type='text'
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder='Enter username'
                    className='w-full border-2 border-neutral4 rounded-xl p-4 outline-none mb-2 focus:border-neutral2 transition'
                    required
                />
                {onlineFriends.length ? (
                    <div className='flex flex-wrap justify-center gap-x-3 gap-y-4 max-h-52 overflow-y-auto py-1 pr-1'>
                        {onlineFriends.map((friend) => {
                            const invited = invitedUserIds.includes(friend.uid) || pendingInviteUserIds.includes(friend.uid)
                            const name = friend?.profile?.displayName ?? 'Friend'
                            return (
                                <button
                                    key={friend.uid}
                                    type='button'
                                    onClick={() => inviteUser(friend.uid)}
                                    disabled={submitting || invited}
                                    className={`group flex min-w-0 flex-col items-center gap-2 text-center transition ${invited ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                                >
                                    <AvatarPicture profile={friend} className='relative w-16 h-16'>
                                        <span className='absolute bottom-0.5 right-0.5 w-4 h-4 border-[3px] border-neutral6 rounded-full bg-sky-400' />
                                    </AvatarPicture>
                                    <span className='w-full truncate text-xs text-neutral0'>{name}</span>
                                </button>
                            )
                        })}
                    </div>
                ) : null}
                {error ? <p className='flex items-center gap-2 text-sm text-red-400'><FaCircleExclamation /> {error}</p> : null}
                <div className='flex gap-4 mt-2'>
                    <Button type='secondary' className='w-full py-4' onClick={closeModal}>Cancel</Button>
                    <Button htmlType='submit' type='primary' className='w-full py-4' disabled={submitting || !isValidUsernameLength || usernameHasPendingInvite} loading={submitting}>Invite</Button>
                </div>
            </form>
        </div>
    )
}

export default PartyInviteModal
