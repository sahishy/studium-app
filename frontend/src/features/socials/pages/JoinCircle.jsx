import { useParams } from "react-router-dom";
import { useAuth } from "../../auth/contexts/AuthContext";
import { useEffect, useState } from "react";
import { canJoinCircle, getCircle, joinCircle } from "../services/circleService.jsx";
import { useNavigate } from "react-router-dom";
import { PiStarFourFill } from "react-icons/pi";
import { FaUserFriends } from "react-icons/fa";
import LoadingState from "../../../shared/components/ui/LoadingState.jsx";
import ErrorState from "../../../shared/components/ui/ErrorState.jsx";
import { useCircles } from "../contexts/CirclesContext.jsx";
import { CIRCLE_MAX_COUNT, getCompetitiveCircle } from "../utils/circleUtils.jsx";
import Card from "../../../shared/components/ui/Card.jsx";
import CircleBanner from "../components/CircleBanner.jsx";

const JoinCircle = () => {

    const { profile } = useAuth();
    const { inviteCode } = useParams();
    const [loading, setLoading] = useState(true)
    const [circle, setCircle] = useState(null);
    const [joinError, setJoinError] = useState('')
    const navigate = useNavigate();
    const circles = useCircles();
    const hasReachedCircleLimit = circles.length >= CIRCLE_MAX_COUNT;

    useEffect(() => {
        if(hasReachedCircleLimit) {
            setCircle(null)
            setJoinError(`You can only join up to ${CIRCLE_MAX_COUNT} circles.`)
            setLoading(false)
            return
        }

        if (!profile || !inviteCode) return;
        let isMounted = true;
        setLoading(true);

        const fetchInvite = async () => {
            try {

                const { circleId, canJoin } = await canJoinCircle(profile.uid, inviteCode);

                if(!isMounted) {
                    return
                }

                if(!canJoin || !circleId) {
                    setCircle(null)
                    setJoinError("Circle doesn't exist or can't be joined")
                    return
                }

                const circleData = await getCircle(circleId);
                if(!isMounted) {
                    return
                }

                if(!circleData) {
                    setCircle(null)
                    setJoinError("Circle doesn't exist or can't be joined")
                    return
                }

                if(circleData.type === 'competitive') {
                    const currentCompetitiveCircle = getCompetitiveCircle(circles)
                    if(currentCompetitiveCircle && currentCompetitiveCircle.uid !== circleData.uid) {
                        setCircle(null)
                        setJoinError('You can only be in one competitive circle at a time.')
                        return
                    }
                }

                setJoinError('')
                setCircle(circleData);

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

    }, [profile, inviteCode, hasReachedCircleLimit, circles]);

    const handleJoin = async () => {

        await joinCircle(profile.uid, circle.uid);
        navigate(`/socials/circle/${circle.uid}`)

    }

    return (
        <div className="w-full h-full flex flex-col justify-center items-center gap-4">

            {(loading || !circle) ? (
                loading ? (
                    <LoadingState/>
                ) : (
                    <ErrorState title={joinError || "Circle doesn't exist or can't be joined"} />
                )
            ) : (
                <Card className='p-6! gap-6 items-center min-w-sm'>

                    <h2 className="text-neutral1">You've been invited to:</h2>

                    <CircleBanner banner={circle.profile.banner} className={'w-16 h-16 text-2xl p-2 rounded-xl'}/>

                    <div className="flex flex-col items-center gap-1">
                        <h1 className="text-lg">{circle.profile.title}</h1>
                        <div className="flex justify-center gap-8 text-neutral1">
                            <div className="flex items-center gap-2">
                                <PiStarFourFill/>
                                <h2>Lv. {circle.level}</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <FaUserFriends/>
                                <h2>{circle.memberCount ?? 0} members</h2>
                            </div>
                        </div>
                    </div>


                    <button 
                        onClick={handleJoin}
                        className='p-2 w-full text-white border-black border-b-4 rounded-xl bg-gray-800 hover:bg-black active:mt-[2px] active:border-b-2 cursor-pointer transition-all '
                    >
                        Join
                    </button>

                </Card>
            )}


        </div>
    )
}

export default JoinCircle