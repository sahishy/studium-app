import { useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import LoadingState from '../../../shared/components/ui/LoadingState'
import CircleMember from '../components/CircleMember'
import { useCircleMembers } from '../services/circleService'
import { useMembers } from '../contexts/MembersContext'

const CircleMembersTab = () => {

    const { circleId } = useOutletContext()
    const { members: circleMembers, loading } = useCircleMembers(circleId)
    const allMembers = useMembers()

    const ownerId = useMemo(
        () => circleMembers.find((member) => member.role === 'owner')?.userId || null,
        [circleMembers]
    )

    const visibleMembers = useMemo(
        () => allMembers.filter((user) => circleMembers.some((member) => member.userId === user.uid)),
        [allMembers, circleMembers]
    )

    const sortedMembers = useMemo(
        () => visibleMembers.slice().sort((a, b) => (a?.profile?.displayName ?? '').localeCompare(b?.profile?.displayName ?? '')),
        [visibleMembers]
    )

    if (loading) {
        return <LoadingState />
    }

    return (
        <div className='flex flex-col gap-4 pt-12'>

            <h2 className='font-semibold text-neutral0'>
                Members <span className='text-neutral1'>{sortedMembers.length}</span>
            </h2>

            {sortedMembers.length > 0 ? (
                <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
                    {sortedMembers.map((member) => (
                        <Link
                            key={member.uid}
                            to={`/profile/${encodeURIComponent(member?.profile?.displayName ?? '')}`}
                        >
                            <CircleMember
                                key={member.uid}
                                profile={member}
                                isOwner={member.uid === ownerId}
                            />
                        </Link>
                    ))}
                </div>
            ) : (
                <div className='flex justify-center items-center py-16'>
                    <p className='text-sm text-neutral1'>No members found for this circle.</p>
                </div>
            )}

        </div>
    )

}

export default CircleMembersTab