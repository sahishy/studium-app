import { PiStarFourFill } from "react-icons/pi";
import { FaFire } from "react-icons/fa6";

const Topbar = ({ profile }) => {
    const streak = profile?.progress?.streak ?? profile?.streak ?? 0
    const level = profile?.progress?.level ?? profile?.level ?? 1

    return (
        <div className="sticky top-0 z-40 bg-neutral6/60 backdrop-blur-xs">
            <div className='text-text0 w-full m-auto px-24 pb-4 pt-6 flex justify-end items-center'>
                <div className="flex gap-8 text-lg font-semibold shrink-0">
                    <div className={`flex items-center gap-4 px-4 ${streak > 0 ? 'text-orange-400' : 'text-text2'}`}>
                        <FaFire className="text-2xl" />
                        <h2>{streak}</h2>
                    </div>

                    <div className="flex items-center gap-4 px-4 text-yellow-400">
                        <PiStarFourFill className="text-2xl" />
                        <h2>Lv. {level}</h2>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Topbar;