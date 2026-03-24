import { PiStarFourFill } from "react-icons/pi";
import { FaFire } from "react-icons/fa6";
import { useNavigate } from "react-router-dom";
import Dropdown from "../Popovers/Dropdown";
import { FaPen, FaTrash } from 'react-icons/fa';
import { PiCaretDownFill } from 'react-icons/pi'
import { BiSolidDoorOpen } from "react-icons/bi";
import { leaveCircle } from "../../services/circleService";
import { useModal } from "../../contexts/ModalContext";
import EditCircleModal from "../modals/EditCircleModal";
import DeleteCircleModal from "../modals/DeleteCircleModal";
import Button from "./Button";

const Header = ( { profile, text, circle, back } ) => {

    const navigate = useNavigate();

    return (
        <div className="sticky top-0 bg-gradient-to-b from-background0 to-transparent from-60% z-10">
            <div className='text-text0 w-full m-auto px-24 pb-4 pt-6 flex justify-between items-center'>
                
                <div className="flex gap-4 items-center min-w-0">
                    {circle ? (
                        <>
                            <Button onClick={() => navigate(back)} type={'secondary'}>
                                Back
                            </Button>
                            <CircleHeader profile={profile} circle={circle} navigate={navigate}/>
                        </>
                    ) : (
                        <h1 className="text-2xl font-extrabold pt-4">{text}</h1>
                    )}
                </div>

                <div className="flex gap-8 text-lg font-semibold shrink-0">

                    <div className={`flex items-center gap-4 px-4 ${profile.streak > 0 ? 'text-orange-400' : 'text-text2'}`}>
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
    const ownerUserId = circle.createdByUserId || circle.createdBy

    const options = (ownerUserId === profile.uid ? [
        { label: 'Edit', icon: <FaPen className="text-sm"/> },
        { isDivider: true },
        { label: 'Delete', icon: <FaTrash className="text-sm"/> }
    ] : [
        { label: 'Leave', icon: <BiSolidDoorOpen className="text-lg"/> },
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
                <div className={`flex items-center rounded-xl p-2 cursor-pointer min-w-0
                ${isOpen ? 'bg-background5' : null} hover:bg-background5 transition-colors duration-200`}>
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