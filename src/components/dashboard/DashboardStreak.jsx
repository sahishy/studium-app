import { FaFire } from "react-icons/fa6";
import Card from "../../pages/main/Card";

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
        <Card>

            <div className="flex items-center gap-4"> 
                <div className="p-4 bg-background3 rounded-xl">
                    <FaFire className="text-2xl text-orange-400"/>
                </div>
                <h1 className="text-2xl font-extrabold text-text1">{profile.streak} day streak!</h1>
            </div>

            <p className="text-sm text-text2">{getRandomStatus()}</p>

        </Card>
    )

}

export default DashboardStreak