import { useCircle } from '../../socials/services/circleService'
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useIsFriend } from "../../socials/services/friendService";
import { FaUserGroup } from "react-icons/fa6";
import TextTooltip from "../../../shared/components/tooltips/TextTooltip";
import { getUserStatsByUserId } from "../services/statsService";

const DisplayName = ({ targetProfile, className, userStats: providedUserStats }) => {

    const { profile } = useOutletContext();
    const isFriend = useIsFriend(profile?.uid, targetProfile?.uid);
    const [userStats, setUserStats] = useState(null);

    const name = targetProfile?.profile?.displayName || 'Unknown';
    const flair = targetProfile?.profile?.flair;

    useEffect(() => {
        if(providedUserStats !== undefined) return
        let isCancelled = false;

        const loadUserStats = async () => {
            const targetUserId = targetProfile?.uid;

            if (!targetUserId) {
                if (!isCancelled) {
                    setUserStats(null);
                }
                return;
            }

            try {
                const nextUserStats = await getUserStatsByUserId(targetUserId);
                if (!isCancelled) {
                    setUserStats(nextUserStats);
                }
            } catch {
                if (!isCancelled) {
                    setUserStats(null);
                }
            }
        };

        loadUserStats();

        return () => {
            isCancelled = true;
        };
    }, [targetProfile?.uid, providedUserStats]);

    const stats = providedUserStats !== undefined ? providedUserStats : userStats;
    const satScore = stats?.academic?.scores?.sat;
    const actScore = stats?.academic?.scores?.act;
    const weightedGpa = stats?.academic?.gpa?.weighted;
    const unweightedGpa = stats?.academic?.gpa?.unweighted;
    const { circle: primaryCircle } = useCircle(targetProfile?.primaryCircleId)
    const circleFlair = primaryCircle?.profile?.flair || null;

    const flairLabel = (() => {
        switch(flair) {
            case 'score:sat':
                return satScore != null ? `${satScore} SAT` : null;
            case 'score:act':
                return actScore != null ? `${actScore} ACT` : null;
            case 'gpa:weighted':
                return weightedGpa != null ? `${weightedGpa} W` : null;
            case 'gpa:unweighted':
                return unweightedGpa != null ? `${unweightedGpa} UW` : null;
            case 'circle':
                return circleFlair != null ? `${circleFlair}` : null;
            default:
                return null;
        }
    })();

    return (
        <div className={`${className} flex items-center gap-2`}>

            {name}

            {flairLabel && (
                <span className="px-2 py-1 text-[10px] rounded-lg bg-neutral5 text-neutral1">
                    {flairLabel}
                </span>
            )}

            {isFriend && (
                <TextTooltip
                    text={'You are friends'}
                >
                    <FaUserGroup className={`${className} text-neutral1 scale-80`} />
                </TextTooltip>
            )}

        </div>
    )

}

export default DisplayName
