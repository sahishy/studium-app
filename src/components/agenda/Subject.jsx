import { FaEllipsisV, FaFolder, FaPen, FaExternalLinkAlt, FaTrash, FaEye } from "react-icons/fa";
import { useModal } from "../../contexts/ModalContext";
import { getColor, extractGoogleFileInfo, formatUrl } from "../../utils/subjectUtils";
import Dropdown from "../Popovers/Dropdown";
import SubjectModal from "../modals/SubjectModal";
import DeleteSubjectModal from "../modals/DeleteSubjectModal";
import DocPreview from "../popovers/DocPreview";

const Subject = ( { subject } ) => {

    const { openModal, closeModal } = useModal()

    const handleSelectOption = (option) => {

        if(option.label === 'Edit') {

            const subjectData = {
                title: subject.title,
                color: subject.color,
                link: subject.link
            }
            openModal(<SubjectModal subject={subject} isEdit={true} subjectData={subjectData} closeModal={closeModal}/>)

        } else if(option.label === 'Delete') {

            openModal(<DeleteSubjectModal subject={subject} closeModal={closeModal}/>)

        }
    }

    return (

        <div className={`flex-1 max-w-xs flex flex-col gap-4 p-2 border-2 border-gray-200 text-gray-600 rounded-lg
        transition-colors duration-200`}>
            {/* hover:bg-gray-800/5 cursor-pointer*/}

            <div className="flex justify-between items-center"> 
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="p-2 bg-gray-100 rounded-lg">
                        <FaFolder className={`text-sm ${getColor(subject.color).textStyle}`}/>
                    </div>
                    
                    <h1 className="text-sm font-semibold text-gray-600 overflow-hidden text-ellipsis whitespace-nowrap">{subject.title}</h1>                   
                </div>

                <div className="flex">
                    {subject.link !== '' && (
                        (extractGoogleFileInfo(subject.link).id !== null ? (

                            <DocPreview
                                doc={extractGoogleFileInfo(subject.link)}
                            >

                                {(isOpen) =>
                                    <button className={`p-2 rounded-lg cursor-pointer ${isOpen ? 'bg-gray-800/5' : null} hover:bg-gray-800/5 transition-colors duration-200`}>
                                        <FaEye className="text-sm"/>
                                    </button>                            
                                }

                            </DocPreview>

                        ) : (

                            <a href={formatUrl(subject.link)} target="_blank">
                                <button className={`p-2 rounded-lg cursor-pointer hover:bg-gray-800/5 transition-colors duration-200`}>
                                    <FaExternalLinkAlt className="text-sm"/>
                                </button>
                            </a>

                        ))
                    )}

                    <Dropdown
                        options={[

                            { label: 'Edit', icon: <FaPen className="text-sm"/> },
                            { isDivider: true },
                            { label: 'Delete', icon: <FaTrash className="text-sm"/> },
                            
                        ]}
                        onSelect={handleSelectOption}
                    >
                        {(isOpen) =>
                            <button className={`p-2 rounded-lg cursor-pointer ${isOpen ? 'bg-gray-800/5' : null} hover:bg-gray-800/5 transition-colors duration-200`}>
                                <FaEllipsisV className="text-sm"/>
                            </button>
                        }
                    </Dropdown>                    
                </div>
  
            </div>

        </div>

    )

}

export default Subject