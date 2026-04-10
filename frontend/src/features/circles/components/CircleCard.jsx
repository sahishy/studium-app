import { PiStarFourFill } from "react-icons/pi";
import Card from "../../../shared/components/ui/Card";
import AvatarPicture from "../../../shared/components/avatar/AvatarPicture";
import { useCircleMembers } from "../services/circleService";
import ProgressBar from "../../../shared/components/ui/ProgressBar";

const CircleCard = ({ circle }) => {

    const { members: circleMembers } = useCircleMembers(circle.uid);

    const xpToNextLevel = Math.pow(2, circle.level) * 100

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

                <ProgressBar
                    value={circle.xp}
                    max={xpToNextLevel}
                    className="flex-1"
                />

            </div>

            <div className="flex items-center">

                {Array.from({ length: Math.min(circle.memberCount || 0, 4) }).map((_, index) => (
                    <AvatarPicture key={index} profile={circleMembers[index]}/>
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