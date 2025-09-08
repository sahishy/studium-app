import { useEffect, useRef } from "react";
import { updateStatus, updateStreak } from "../../utils/userUtils";

const ActivityHandler = ( { profile } ) => {

    const inactivityPeriod = 24 * (60 * 60 * 1000);
    const checkPeriod = 5 * (1000);

    const lastStatus = useRef(null);
    const lastActivityTimeRef = useRef(Date.now());
    const lastCheckRef = useRef(Date.now());
    const lastSeen = useRef(profile.lastSeen);
    
    useEffect(() => {
        lastSeen.current = profile.lastSeen;
    }, [profile.lastSeen])

    const getDaysDifference = (lastSeenTs) => {

        const now = new Date();
        const seenDate = new Date(lastSeenTs * 1000);

        const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const seenMid = new Date(seenDate.getFullYear(), seenDate.getMonth(), seenDate.getDate());
        const msPerDay = 1000 * 60 * 60 * 24;

        return Math.floor((todayMid - seenMid) / msPerDay);

    };
    
    const tryUpdateStreak = () => {
        const daysDiff = getDaysDifference(lastSeen.current?.seconds || 0);
    
        if(daysDiff === 1) {

            updateStreak(profile);
            updateStatus(profile, "active");

        } else if(daysDiff > 1 && profile.streak !== 0) {

            updateStreak(profile, true);

        }

      };

    const tryUpdateStatus = () => {

        const isActive = Date.now() - lastActivityTimeRef.current <= inactivityPeriod;

        if(isActive && lastStatus.current !== "active") {

            updateStatus(profile, 'active');
            lastStatus.current = "active";

        } else if(!isActive && lastStatus.current !== "inactive") {

            updateStatus(profile, 'inactive');
            lastStatus.current = "inactive";

        }

    }

    const tryUpdateActivity = () => {

        if(Date.now() - lastCheckRef.current < checkPeriod) {
            return;
        }

        tryUpdateStreak();
        tryUpdateStatus();

        lastCheckRef.current = Date.now();

    }

    const handleBeforeUnload = () => {
        updateStatus(profile, "inactive");
    };

    useEffect(() => {

        const handleUserActivity = () => {
            lastActivityTimeRef.current = Date.now();
            tryUpdateActivity();
        }

        window.addEventListener("click", handleUserActivity);
        window.addEventListener("keypress", handleUserActivity);
        window.addEventListener("scroll", handleUserActivity);
        window.addEventListener("mousemove", handleUserActivity);
        window.addEventListener("beforeunload", handleBeforeUnload);

        const interval = setInterval(tryUpdateActivity, checkPeriod);

        return () => {
            updateStatus(profile, "inactive");
            window.removeEventListener("click", handleUserActivity);
            window.removeEventListener("keypress", handleUserActivity);
            window.removeEventListener("scroll", handleUserActivity);
            window.removeEventListener("mousemove", handleUserActivity);
            window.removeEventListener("beforeunload", handleBeforeUnload);
            clearInterval(interval);
        }

    }, [lastStatus]);

    return null
}

export default ActivityHandler;