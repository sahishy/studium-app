import { FaUserFriends } from "react-icons/fa";
import CircleFriend from "./CircleFriend";
import { useMembers } from "../../contexts/MembersContext";

const CircleFriends = ( { userId } ) => {

    const members = useMembers();
    const friends = members.filter(x => x.uid !== userId);

    return (
        <div className="flex flex-col gap-4 p-4 bg-white rounded-lg border-2 border-gray-200 min-w-0">

            <div className="flex items-center gap-4">
                <div className="p-4 bg-gray-100 rounded-lg">
                    <FaUserFriends className="text-2xl text-sky-400"/>
                </div>
                <div className="flex flex-col">
                    <h1 className="text-2xl font-extrabold text-gray-600">Friends</h1>
                </div>
            </div>

            <div className='flex flex-col gap-2 min-w-0'>

                {friends.length === 0 ? (

                    <p className='text-sm text-center text-gray-400'>You have no Studium friends.</p>

                ) : (
                    <>
                        {friends.sort((a, b) => (b.status === 'active') - (a.status === 'active')).map((friend, index) => (

                            <CircleFriend key={index} profile={friend}/>

                        ))}
                    </>
                )}

            </div>

        </div>
    )

}

export default CircleFriends