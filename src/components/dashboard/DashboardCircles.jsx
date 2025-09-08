import { FaUserFriends } from "react-icons/fa";
import DashboardCircle from "./DashboardCircle";
import { useCircles } from "../../contexts/CirclesContext";
import Card from "../../pages/main/Card";

const DashboardCircles = () => {

    const circles = useCircles();

    return (
        <Card>
            <div className="flex items-center gap-4">
                <div className="p-4 bg-sky-400/15 rounded-xl">
                    <FaUserFriends className="text-2xl text-sky-400"/>
                </div>
                <div className="flex flex-col">
                    <h1 className="text-xl font-extrabold text-text1">Top Study Circles</h1>
                </div>
            </div>

            <div className="flex flex-col gap-2 w-full min-w-0">

                {circles.length === 0 ? (

                    <p className='text-sm text-center text-text2'>You aren't in any study circles.</p>

                    ) : (
                        circles.sort((a, b) => b.level - a.level).slice(0, 3).map((circle) => (
                            <DashboardCircle key={circle.uid} circle={circle}/>
                        ))
                    )
                    
                }
                
            </div>

        </Card>
    )
}

export default DashboardCircles