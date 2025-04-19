import { PiStarFourFill } from "react-icons/pi";
import pfp from '../../assets/default-profile.jpg'

const Circle = ( { circle } ) => {

    const getXPBarWidth = () => {

        const xp = circle.xp
        const xpToNextLevel = Math.pow(2, circle.level) * 100

        return (xp / xpToNextLevel) * 100

    }

    return (
        <div className="group flex flex-col gap-2 p-4 bg-white rounded-lg border-2 border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer duration-200">

            <div className="flex items-center gap-4 min-w-0"> 
                <div className="bg-gray-100 rounded-lg">

                    {circle.icon ? (
                        null
                    ) : (
                        <div className="w-10 h-10 p-2 flex justify-center items-center text-lg text-gray-400">
                            {circle.title[0]}
                        </div>
                    )}

                </div>
                <h1 className="text-lg font-extrabold text-gray-600 truncate">{circle.title}</h1>
            </div>

            <div className="flex items-center">

                {circle.userIds.slice(0, 4).map((userId, index) => (
                    <img
                        key={userId}
                        src={pfp}
                        alt="Profile"
                        className={`w-10 h-10 rounded-full border-4 group-hover:border-gray-100 border-white ${index !== 0 ? '-ml-3' : ''} transition-colors duration-200`}
                        style={{ zIndex: 4 - index }}
                    />
                ))}
                {circle.userIds.length > 4 && (
                    <div className="w-10 h-10 rounded-full border-4 group-hover:border-gray-100 border-white -ml-3 flex items-center justify-center bg-gray-100 text-sm text-gray-400 transition-colors duration-200">
                        +{circle.userIds.length - 4}
                    </div>                    
                )}

            </div>
            
            <div className="flex items-center gap-4 mt-2">

                <h1 className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-400">
                    <PiStarFourFill/>
                    Lv. {circle.level}
                </h1>

                <div className="flex-1 bg-gray-100 w-full h-4 rounded-full overflow-hidden">
                    <div 
                        className="bg-sky-400 rounded-full h-full transition-all duration-1000"
                        style={{ width: `${getXPBarWidth()}%` }}
                    >
                        <div className="h-[30%] translate-y-[3px] mx-[3px] rounded-full bg-sky-300"></div>
                    </div>
                </div>

            </div>

        </div>
    )

}

export default Circle;