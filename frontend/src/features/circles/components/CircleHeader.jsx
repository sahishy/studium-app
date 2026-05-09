import { useNavigate } from "react-router-dom";
import Dropdown from "../../../shared/components/popovers/Dropdown";
import { FaPen, FaTrash } from 'react-icons/fa';
import { PiCaretDownFill } from 'react-icons/pi';
import { BiSolidDoorOpen } from "react-icons/bi";
import { leaveCircle } from "../services/circleService";
import { useModal } from "../../../shared/contexts/ModalContext";
import EditCircleModal from "./modals/EditCircleModal";
import DeleteCircleModal from "./modals/DeleteCircleModal";
import Button from "../../../shared/components/ui/Button";

const CircleHeader = ({ circle, profile, back = '/circles' }) => {
    const navigate = useNavigate();
    const { openModal, closeModal } = useModal();
    const ownerUserId = circle.createdByUserId || circle.createdBy;

    const options = ownerUserId === profile.uid
        ? [
            { label: 'Edit', icon: <FaPen className="text-sm" /> },
            { isDivider: true },
            { label: 'Delete', icon: <FaTrash className="text-sm" /> }
        ]
        : [
            { label: 'Leave', icon: <BiSolidDoorOpen className="text-lg" /> }
        ];

    const handleSelectOption = (option) => {
        if (option.label === 'Leave') {
            leaveCircle(profile.uid, circle.uid);
            navigate('/circles');
        } else if (option.label === 'Edit') {
            openModal(<EditCircleModal circle={circle} closeModal={closeModal} />);
        } else if (option.label === 'Delete') {
            openModal(<DeleteCircleModal circle={circle} closeModal={closeModal} />);
        }
    };

    return (
        <div className='w-full flex items-center gap-4'>
            {/* <Button onClick={() => navigate(back)} type={'secondary'}>
                Back
            </Button> */}

            <Dropdown
                options={options}
                onSelect={handleSelectOption}
                className='self-start min-w-0'
            >
                {(isOpen) =>
                    <div
                        className={`flex items-center rounded-xl p-2 cursor-pointer min-w-0
                        ${isOpen ? 'bg-neutral3' : null} hover:bg-neutral3 transition-colors `}
                    >
                        <h1 className="px-2 text-2xl font-semibold truncate">{circle.title}</h1>
                        <div className="p-2">
                            <PiCaretDownFill className="text-sm" />
                        </div>
                    </div>
                }
            </Dropdown>
        </div>
    );
};

export default CircleHeader;