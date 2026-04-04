import { FaCrown } from "react-icons/fa6";
import AvatarPicture from '../avatar/AvatarPicture';

const CircleMember = ( { profile, isOwner } ) => {

    const isOpen = false;

    return (
        <div className='p-2 rounded-xl border-2 border-neutral4 flex items-center gap-4 shadow-lg shadow-shadow'>
            <AvatarPicture profile={profile}/>

            <div className="flex flex-col pr-2 min-w-0">

                <div className='flex items-center gap-2 text-text1 shrink-0'>
                    {isOwner && (
                        <FaCrown/>
                    )}
                    <div>
                        {profile.firstName} {profile.lastName.substring(0, 1)}.
                    </div>
                </div>
            </div>
        </div>
    )
    
}

export default CircleMember