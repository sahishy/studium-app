import { useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useEffect, useState } from "react";
import { canJoinCircle, getCircle, joinCircle } from "../../utils/circleUtils";
import { useNavigate } from "react-router-dom";
import { PiStarFourFill } from "react-icons/pi";
import { FaUserFriends } from "react-icons/fa";

const JoinCircle = () => {

    const { profile } = useAuth();
    const { inviteCode } = useParams();
    const [loading, setLoading] = useState(true)
    const [circle, setCircle] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!profile || !inviteCode) return;
        let isMounted = true;
        setLoading(true);

        const fetchInvite = async () => {
            try {

                const { circleId, canJoin } = await canJoinCircle(profile.uid, inviteCode);

                if(!isMounted) {
                    return
                }

                if(canJoin) {
                    const circleData = await getCircle(circleId);
                    if(!isMounted) {
                        return
                    }
                    setCircle(circleData);
                }

            } catch(error) {
                console.error("Invite error:", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchInvite();

        return () => {
            isMounted = false;
        }

    }, [profile, inviteCode]);

    const handleJoin = async () => {

        await joinCircle(profile.uid, circle.uid);
        navigate(`/circles/${circle.uid}`)

    }

    return (
        <div className="w-full h-full flex flex-col justify-center items-center gap-4">

            {(loading || !circle) ? (
                loading ? (
                    <p className="text-lg font-semibold text-gray-600">Loading invite...</p>
                ) : (
                    <p className="text-lg font-semibold text-gray-600">Circle doesn't exist or can't be joined!</p>
                )
            ) : (
                <div className="p-4 border-2 border-gray-200 rounded-lg flex flex-col gap-4 text-center min-w-xs">

                    <h2 className="text-gray-600">You've been invited to:</h2>

                    <h1 className="text-2xl">{circle.title}</h1>

                    <div className="flex justify-center gap-8 text-gray-400">
                        <div className="flex items-center gap-2">
                            <PiStarFourFill/>
                            <h2>Lv. {circle.level}</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <FaUserFriends/>
                            <h2>{circle.userIds.length} members</h2>
                        </div>
                    </div>

                    <button 
                        onClick={handleJoin}
                        className='p-2 w-full text-white border-black border-b-4 rounded-lg bg-gray-800 hover:bg-black active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                    >
                        Join
                    </button>

                </div>
            )}


        </div>
    )
}

export default JoinCircle