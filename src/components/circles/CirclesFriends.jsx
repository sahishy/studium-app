import { FaUserFriends } from "react-icons/fa";
import CircleFriend from "./CircleFriend";
import { useMembers } from "../../contexts/MembersContext";
import Card from "../../pages/main/Card";

const CircleFriends = ( { userId } ) => {

    const members = useMembers();
    const friends = members.filter(x => x.uid !== userId);

    return (
        <Card>

            <div className="flex items-center gap-4">
                <div className="p-4 bg-sky-400/15 rounded-xl">
                    <FaUserFriends className="text-2xl text-sky-400"/>
                </div>
                <div className="flex flex-col">
                    <h1 className="text-xl font-extrabold text-text1">Friends</h1>
                </div>
            </div>

            <div className='flex flex-col gap-2 min-w-0'>

                {friends.length === 0 ? (

                    <p className='text-sm text-center text-text2'>You have no Studium friends.</p>

                ) : (
                    <>
                        {friends.sort((a, b) => (b.status === 'active') - (a.status === 'active')).map((friend, index) => (

                            <CircleFriend key={index} profile={friend}/>

                        ))}
                    </>
                )}

            </div>

        </Card>
    )

}

export default CircleFriends