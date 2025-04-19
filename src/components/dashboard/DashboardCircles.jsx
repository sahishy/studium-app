import { FaUserFriends } from "react-icons/fa";
import DashboardCircle from "./DashboardCircle";
import { useCircles } from "../../contexts/CirclesContext";

const DashboardCircles = () => {

    const circles = useCircles();

    return (
        <div className="flex flex-col gap-4 p-4 bg-white rounded-lg border-2 border-gray-200 w-full min-w-0">

            <div className="flex items-center gap-4">
                <div className="p-4 bg-gray-100 rounded-lg">
                    <FaUserFriends className="text-2xl text-sky-400"/>
                </div>
                <div className="flex flex-col">
                    <h1 className="text-2xl font-extrabold text-gray-600">Top Study Circles</h1>
                </div>
            </div>

            <div className="flex flex-col gap-2 w-full min-w-0">

                {circles.length === 0 ? (

                    <p className='text-sm text-center text-gray-400'>You aren't in any study circles.</p>

                    ) : (
                        circles.sort((a, b) => b.level - a.level).slice(0, 3).map((circle) => (
                            <DashboardCircle key={circle.uid} circle={circle}/>
                        ))
                    )
                    
                }
                
            </div>

        </div>
    )

}

export default DashboardCircles