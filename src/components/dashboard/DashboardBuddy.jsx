import { TbPawFilled } from "react-icons/tb";

const DashboardPet = ( { profile } ) => {

    return (
        <Card>

            <div className="flex items-center gap-4"> 
                <div className="p-4 bg-background3 rounded-xl">
                    <TbPawFilled className="text-2xl text-fuchsia-400"/>
                </div>
                <h1 className="text-2xl font-extrabold text-text1">Study Buddy</h1>
            </div>

            <p className="text-sm text-text2 text-center">Coming soon!</p>

        </Card>
    )

}

export default DashboardPet