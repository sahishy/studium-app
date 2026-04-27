import { PiStarFourFill } from "react-icons/pi"
import Card from "../../../shared/components/ui/Card"
import ProgressBar from "../../../shared/components/ui/ProgressBar"
import { getXpToNextLevel } from "../../profile/utils/xpUtils"

const CircleGreeting = ( { circle } ) => {

    const xpToNextLevel = getXpToNextLevel(circle.level)

    return (
        <Card className={'flex-1'}>

            <div className="flex items-center gap-4">
                <div className="p-4 bg-sky-400/15 rounded-xl">
                    <PiStarFourFill className="text-2xl text-sky-400"/>
                </div>
                <div className="flex flex-col">
                    <h1 className="text-xl font-semibold text-text1">Level {circle.level}</h1>
                </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
                <ProgressBar
                    value={circle.xp}
                    max={xpToNextLevel}
                />

                <h1 className="inset-0 flex items-center justify-center text-sm font-semibold text-text2">
                    {circle.xp} / {xpToNextLevel} XP
                </h1>
            </div>

        </Card>
    )
}

export default CircleGreeting