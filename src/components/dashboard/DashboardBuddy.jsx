import { TbPawFilled } from "react-icons/tb";

const DashboardPet = ( { profile } ) => {

    return (
        <div className="flex flex-col gap-4 p-4 bg-white rounded-lg border-2 border-gray-200">

            <div className="flex items-center gap-4"> 
                <div className="p-4 bg-gray-100 rounded-lg">
                    <TbPawFilled className="text-2xl text-fuchsia-400"/>
                </div>
                <h1 className="text-2xl font-extrabold text-gray-600">Study Buddy</h1>
            </div>

            <p className="text-sm text-gray-400 text-center">Coming soon!</p>

        </div>
    )

}

export default DashboardPet