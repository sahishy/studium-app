import { PiStarFourFill } from "react-icons/pi"

const CircleGreeting = ( { circle } ) => {

    const getXPBarWidth = () => {

        const xp = circle.xp
        const xpToNextLevel = Math.pow(2, circle.level) * 100

        return (xp / xpToNextLevel) * 100

    }

    return (
        <div className="flex-1 flex flex-col justify-center gap-4 p-4 bg-white rounded-lg border-2 border-gray-200">

            <div className="flex items-center gap-4">
                <div className="p-4 bg-gray-100 rounded-lg">
                    <PiStarFourFill className="text-2xl text-sky-400"/>
                </div>
                <div className="flex flex-col">
                    <h1 className="text-2xl font-extrabold text-gray-600">Level {circle.level}</h1>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-100 w-full h-4 rounded-full overflow-hidden">
                    <div 
                        className="bg-sky-400 rounded-full h-full transition-all duration-1000"
                        style={{ width: `${getXPBarWidth()}%` }}
                    >
                        <div className="h-[30%] translate-y-[3px] mx-[3px] rounded-full bg-sky-300"></div>
                    </div>
                </div>

                <h1 className="inset-0 flex items-center justify-center text-sm font-semibold text-gray-400">
                    {circle.xp} / {Math.pow(2, circle.level) * 100} XP
                </h1>
            </div>

        </div>
    )
}

export default CircleGreeting