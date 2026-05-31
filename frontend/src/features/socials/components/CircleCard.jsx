import { PiStarFourFill } from "react-icons/pi";
import Card from "../../../shared/components/ui/Card";
import AvatarPicture from "../../../shared/components/avatar/AvatarPicture";
import { useCircleMembers } from "../services/circleService";
import ProgressBar from "../../../shared/components/ui/ProgressBar";
import { useMembers } from "../contexts/MembersContext";
import { HiChevronDoubleUp } from "react-icons/hi";
import { FaBookOpen, FaTrophy, FaUserGroup } from "react-icons/fa6";
import CircleBanner from "./CircleBanner";
import { useTasks } from "../../agenda/contexts/TasksContext";
import { useMemo } from "react";
import { extractTaskTitleMetadata } from "../../agenda/utils/naturalLanguage";

const CircleCard = ({ circle }) => {

    const { members: circleMembers } = useCircleMembers(circle.uid);
    const allMembers = useMembers();
    const { circle: circleTasks = [] } = useTasks();

    const xpToNextLevel = Math.pow(2, circle.level) * 100
    const isCompetitive = circle.type === 'competitive'
    const circleTaskCount = useMemo(() => {
        return circleTasks.filter((task) => extractTaskTitleMetadata(task.title).circleId === circle.uid).length
    }, [circleTasks, circle.uid])
    const circleTotalElo = Number(circle.totalElo) || 0

    return (
        <Card
            style={{background: `linear-gradient(to bottom, ${circle.profile.banner.bgColor.slice(0, -2)}14, transparent)`}}
            hoverable={true}
        >

            <div className="flex items-center gap-4">
                <CircleBanner
                    banner={circle.profile.banner}
                    className='rounded-xl w-24 h-24 p-2 text-4xl pointer-events-none'
                />
                <div className="flex-1 min-w-0 flex flex-col gap-1">

                    <div className="flex items-center gap-2 min-w-0">
                        <h1 className="min-w-0 text-lg font-semibold text-neutral0 truncate">{circle.profile.title}</h1>
                        {circle.profile.flair && (
                            <span className="shrink-0 px-2 py-1 text-[10px] rounded-lg bg-neutral5 text-neutral1">
                                {circle.profile.flair}
                            </span>
                        )}
                    </div>

                    {isCompetitive ? (
                        <p className="flex items-center gap-2 text-sm text-neutral1">
                            <FaTrophy className="text-xs" />
                            <span>
                                {circleTotalElo} <span className="text-[10px]">SAT</span>
                            </span>
                        </p>
                    ) : (
                        <p className="flex items-center gap-2 text-sm text-neutral1">
                            <FaBookOpen className="text-xs" /> {circleTaskCount} task{circleTaskCount !== 1 && 's'}
                        </p>
                    )}

                    <p className="flex items-center gap-2 text-sm text-neutral1">
                        <FaUserGroup className="text-xs" /> {circle.memberCount} member{circle.memberCount !== 1 && 's'}
                    </p>

                </div>
            </div>

            <div className="flex items-center gap-4">
                <h1 className="flex items-center justify-center gap-2 text-sm font-semibold text-neutral1">
                    <PiStarFourFill />
                    Lv. {circle.level}
                </h1>
                <ProgressBar
                    value={circle.xp}
                    max={xpToNextLevel}
                    className="flex-1"
                />
                <h1 className="flex items-center justify-center gap-2 text-sm font-semibold text-neutral1">
                    {200} xp left
                    <HiChevronDoubleUp />
                </h1>
            </div>

            <div className="flex items-center">

                {Array.from({ length: Math.min(circle.memberCount || 0, 4) }).map((_, index) => (
                    <AvatarPicture key={index} profile={allMembers.filter((user) => circleMembers.some((member) => member.userId === user.uid))[index]} className="w-10 h-10 outline-4 outline-neutral6 rounded-full" />
                ))}
                {(circle.memberCount || 0) > 4 && (
                    <div className="w-12 h-12 rounded-full border-4 border-neutral6 -ml-3 flex items-center justify-center bg-neutral5 text-sm text-neutral1 transition-colors ">
                        +{(circle.memberCount || 0) - 4}
                    </div>
                )}

            </div>

        </Card >
    )

}

export default CircleCard;