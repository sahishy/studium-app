import { PiStarFourFill } from "react-icons/pi";
import pfp from '../../assets/default-profile.jpg'

const DashboardCircle = ( { circle } ) => {

    return (
        <div className="p-2 rounded-lg border-2 border-gray-200 flex items-center gap-2 w-full min-w-0">

            <div className="flex items-center">
                {circle.userIds.slice(0, 3).map((userId, index) => (
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

            <div className="flex items-center gap-2 flex-1 min-w-0 max-w-full">
                <h1 className="text-gray-600 text-sm font-semibold truncate max-w-full">
                    {circle.title}
                </h1>
                <h2 className="p-2 text-gray-400 flex gap-2 items-center shrink-0">
                    <PiStarFourFill/>
                    Lv. {circle.level}
                </h2>
            </div>

        </div>
    )

}

export default DashboardCircle