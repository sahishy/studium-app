import { PiStarFourFill } from "react-icons/pi";
import { FaFire } from "react-icons/fa6";

const Topbar = ({ profile }) => {
    return (
        <div className="sticky top-0 from-60% z-10">
            <div className='text-text0 w-full m-auto px-24 pb-4 pt-6 flex justify-end items-center'>
                <div className="flex gap-8 text-lg font-semibold shrink-0">
                    <div className={`flex items-center gap-4 px-4 ${profile.streak > 0 ? 'text-orange-400' : 'text-text2'}`}>
                        <FaFire className="text-2xl" />
                        <h2>{profile.streak}</h2>
                    </div>

                    <div className="flex items-center gap-4 px-4 text-yellow-400">
                        <PiStarFourFill className="text-2xl" />
                        <h2>Lv. {profile.level}</h2>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Topbar;