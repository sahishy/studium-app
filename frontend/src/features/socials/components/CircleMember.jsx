import { FaCircle, FaCrown } from 'react-icons/fa6'
import AvatarPicture from '../../../shared/components/avatar/AvatarPicture'
import Card from '../../../shared/components/ui/Card'
import DisplayName from '../../profile/components/DisplayName'

const CircleMember = ({ profile, isOwner }) => {

    if (!profile) {
        return null
    }

    return (
        <Card className='gap-2' hoverable>
            <div className='flex items-center gap-3 min-w-0'>

                <AvatarPicture profile={profile} className='w-16 h-16' />

                <div className='flex flex-col min-w-0'>
                    <h2 className='text-sm flex items-center gap-2 '>
                        <DisplayName targetProfile={profile} className={'min-w-0 flex-1'}/>
                        {!isOwner && <FaCrown className='text-neutral1 shrink-0' />}
                    </h2>
                    <p className='flex gap-1 items-center text-sm text-neutral1'>
                        <FaCircle className='text-[6px] text-sky-400' /> Online
                    </p>
                </div>

            </div>
        </Card>
    )

}

export default CircleMember