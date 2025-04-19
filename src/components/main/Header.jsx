import { PiStarFourFill } from "react-icons/pi";
import { FaFire } from "react-icons/fa6";
import { useNavigate } from "react-router-dom";
import Dropdown from "../Popovers/Dropdown";
import { FaPen, FaTrash } from 'react-icons/fa';
import { PiCaretDownFill } from 'react-icons/pi'
import { TbLogout2 } from "react-icons/tb";
import { leaveCircle } from "../../utils/circleUtils";
import { useModal } from "../../contexts/ModalContext";
import EditCircleModal from "../modals/EditCircleModal";
import DeleteCircleModal from "../modals/DeleteCircleModal";

const Header = ( { profile, text, circle, back } ) => {

    const navigate = useNavigate();

    return (
        <div className="">
            <div className='text-gray-800 w-full max-w-5xl m-auto px-8 py-4 mt-4 flex justify-between items-center'>
                
                <div className="flex gap-4 items-center min-w-0">
                    {circle ? (
                        <>
                            <button
                                onClick={() => navigate(back)}
                                className='px-4 py-2 border-2 border-gray-200 border-b-4 rounded-lg hover:bg-gray-800/5 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                            >
                                Back
                            </button>
                            <CircleHeader profile={profile} circle={circle} navigate={navigate}/>
                        </>
                    ) : (
                        <h1 className="text-2xl font-extrabold pt-4">{text}</h1>
                    )}
                </div>

                <div className="flex gap-8 text-lg font-semibold shrink-0">

                    <div className={`flex items-center gap-4 px-4 ${profile.streak > 0 ? 'text-orange-400' : 'text-gray-400'}`}>
                        <FaFire className="text-2xl"/>
                        <h2>{profile.streak}</h2>
                    </div>

                    <div className="flex items-center gap-4 px-4 text-yellow-400">
                        <PiStarFourFill className="text-2xl"/>
                        <h2>Lv. {profile.level}</h2>
                    </div>

                </div>

            </div>
        </div>
    )
}

const CircleHeader = ( { circle, profile, navigate } ) => {

    const { openModal, closeModal } = useModal()

    const options = (circle.createdBy === profile.uid ? [
        { label: 'Edit', icon: <FaPen className="text-sm"/> },
        { isDivider: true },
        { label: 'Delete', icon: <FaTrash className="text-sm"/> }
    ] : [
        { label: 'Leave', icon: <TbLogout2 className="text-sm"/> },
    ])

    const handleSelectOption = (option) => {
        
        if(option.label === 'Leave') {
            
            leaveCircle(profile.uid, circle.uid);
            navigate('/circles')

        } else if(option.label === 'Edit') {

            openModal(<EditCircleModal circle={circle} closeModal={closeModal}/>)

        } else if(option.label === 'Delete') {

            openModal(<DeleteCircleModal circle={circle} closeModal={closeModal}/>)

        }

    }

    return (
        <Dropdown
            options={options}
            onSelect={handleSelectOption}
            className='self-start min-w-0'
        >
            {(isOpen) =>
                <div className={`flex items-center rounded-lg p-2 cursor-pointer min-w-0
                ${isOpen ? 'bg-gray-800/5' : null} hover:bg-gray-800/5 transition-colors duration-200`}>
                    <h1 className="px-2 text-2xl font-extrabold truncate">{circle.title}</h1>
                    <div className="p-2">
                        <PiCaretDownFill className="text-sm"/>
                    </div>
                </div>
            }
        </Dropdown>
    )

}


export default Header;