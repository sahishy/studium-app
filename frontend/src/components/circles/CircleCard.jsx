import { PiStarFourFill } from "react-icons/pi";
import pfp from '../../assets/images/default-profile.jpg'
import Card from "../main/Card";
import Avatar from "../avatar/Avatar";
import { useCircleMembers } from "../../services/circleService";

const CircleCard = ({ circle }) => {

    const { members: circleMembers, loading: circleMembersLoading } = useCircleMembers(circle.uid);

    const getXPBarWidth = () => {

        const xp = circle.xp
        const xpToNextLevel = Math.pow(2, circle.level) * 100

        return (xp / xpToNextLevel) * 100

    }

    return (
        <Card hoverable={true}>

            <div className="flex items-center gap-4 min-w-0">
                <div className="bg-background3 rounded-xl">

                    {circle.icon ? (
                        null
                    ) : (
                        <div className="w-10 h-10 p-2 flex justify-center items-center text-lg text-text2">
                            {circle.title[0]}
                        </div>
                    )}

                </div>
                <h1 className="text-lg font-semibold text-text1 truncate">{circle.title}</h1>
            </div>

            <div className="flex items-center gap-4">

                <h1 className="flex items-center justify-center gap-2 text-sm font-semibold text-text2">
                    <PiStarFourFill />
                    Lv. {circle.level}
                </h1>

                <div className="flex-1 bg-background3 w-full h-4 rounded-full overflow-hidden">
                    <div
                        className="bg-sky-400 rounded-full h-full transition-all duration-1000"
                        style={{ width: `${getXPBarWidth()}%` }}
                    >
                        <div className="h-[30%] translate-y-[3px] mx-[3px] rounded-full bg-sky-300"></div>
                    </div>
                </div>

            </div>

            <div className="flex items-center">

                {Array.from({ length: Math.min(circle.memberCount || 0, 4) }).map((_, index) => (
                    <Avatar key={index} profile={circleMembers[index]}/>
                ))}
                {(circle.memberCount || 0) > 4 && (
                    <div className="w-10 h-10 rounded-full border-4 border-background1 -ml-3 flex items-center justify-center bg-background3 text-sm text-text2 transition-colors ">
                        +{(circle.memberCount || 0) - 4}
                    </div>
                )}

            </div>

        </Card>
    )

}

export default CircleCard;