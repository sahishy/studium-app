import { PiStarFourFill } from "react-icons/pi";
import pfp from '../../assets/default-profile.jpg'
import Card from "../main/Card";

const Circle = ( { circle } ) => {

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
                <h1 className="text-lg font-extrabold text-text1 truncate">{circle.title}</h1>
            </div>

            <div className="flex items-center">

                {Array.from({ length: Math.min(circle.memberCount || 0, 4) }).map((_, index) => (
                    <img
                        key={index}
                        src={pfp}
                        alt="Profile"
                        className={`w-10 h-10 rounded-full border-4 group-hover:border-background4 border-background1 ${index !== 0 ? '-ml-3' : ''} transition-colors duration-200`}
                        style={{ zIndex: 4 - index }}
                    />
                ))}
                {(circle.memberCount || 0) > 4 && (
                    <div className="w-10 h-10 rounded-full border-4 group-hover:border-background4 border-background1 -ml-3 flex items-center justify-center bg-background3 text-sm text-text2 transition-colors duration-200">
                        +{(circle.memberCount || 0) - 4}
                    </div>                    
                )}

            </div>
            
            <div className="flex items-center gap-4">

                <h1 className="flex items-center justify-center gap-2 text-sm font-semibold text-text2">
                    <PiStarFourFill/>
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

        </Card>
    )

}

export default Circle;