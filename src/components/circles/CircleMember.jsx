import pfp from '../../assets/images/default-profile.jpg'
import { FaCrown } from "react-icons/fa6";

const CircleMember = ( { profile, isOwner } ) => {

    const isOpen = false;

    return (
        <div className='p-2 rounded-xl border-2 border-neutral4 flex items-center gap-4 shadow-lg shadow-shadow'>
            <div className="relative w-8 h-8 shrink-0">
                <img
                    src={pfp} 
                    alt="profile"
                    className="w-full h-full rounded-full object-cover"
                />
                <span
                    className={`absolute bottom-0 right-0 w-3 h-3 ${profile.status === 'active' ? 'bg-emerald-400' : 'bg-gray-400'} border-2 ${isOpen && 'border-background4'} group-hover:border-background4 border-background0 rounded-full  transition-colors `}
                ></span>
            </div>

            <div className="flex flex-col pr-2 min-w-0">

                <div className='flex items-center gap-2 text-text1 shrink-0'>
                    {isOwner && (
                        <FaCrown/>
                    )}
                    <div>
                        {profile.firstName} {profile.lastName.substring(0, 1)}.
                    </div>
                </div>
                {profile.currentTask && (
                    <div className='text-sm text-text2 truncate'>
                        {profile.currentTask.title}
                    </div>
                )}
            </div>
        </div>
    )
    
}

export default CircleMember