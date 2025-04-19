import { FaFire } from "react-icons/fa6";

const DashboardStreak = ( { profile } ) => {

    const getRandomStatus = () => {

        if(profile.streak == 0) {
            return "Let's get our journey started."
        } else if(profile.streak < 7) {
            return "Great progress! Keep it up."
        } else{ 
            return "You're on fire! Stay consistent."
        }

    }

    return (
        <div className="flex flex-col gap-4 p-4 bg-white rounded-lg border-2 border-gray-200">

            <div className="flex items-center gap-4"> 
                <div className="p-4 bg-gray-100 rounded-lg">
                    <FaFire className="text-2xl text-orange-400"/>
                </div>
                <h1 className="text-2xl font-extrabold text-gray-600">{profile.streak} day streak!</h1>
            </div>

            <p className="text-sm text-gray-400">{getRandomStatus()}</p>

        </div>
    )

}

export default DashboardStreak