import { FaEllipsisV, FaFolder, FaPen, FaExternalLinkAlt, FaTrash, FaEye } from "react-icons/fa";
import { useModal } from "../../contexts/ModalContext";
import { getColor, extractGoogleFileInfo, formatUrl } from "../../utils/subjectUtils";
import Dropdown from "../Popovers/Dropdown";
import SubjectModal from "../modals/SubjectModal";
import DeleteSubjectModal from "../modals/DeleteSubjectModal";
import DocPreview from "../popovers/DocPreview";
import Card from "../../pages/main/Card";

const Subject = ( { subject } ) => {

    const { openModal, closeModal } = useModal()

    const handleSelectOption = (option) => {

        if(option.label === 'Edit') {

            const subjectData = {
                title: subject.title,
                day: subject.day,
                color: subject.color,
                link: subject.link
            }
            openModal(<SubjectModal subject={subject} isEdit={true} subjectData={subjectData} closeModal={closeModal}/>)

        } else if(option.label === 'Delete') {

            openModal(<DeleteSubjectModal subject={subject} closeModal={closeModal}/>)

        }
    }

    return (

        <Card className={'!gap-2 !p-2'}>
            {/* hover:bg-background5 cursor-pointer*/}

            <div className={`flex items-center justify-center rounded-xl aspect-video ${getColor(subject.color).bgStyle}`}>
                <FaFolder className={`text-4xl ${getColor(subject.color).textStyle}`}/>
            </div>

            <div className="flex justify-between items-center p-2">

                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <h1 className="font-semibold text-text1 overflow-hidden text-ellipsis whitespace-nowrap">{subject.title}</h1>                   
                </div>

                <div className="flex">
                    {subject.link !== '' && (
                        (extractGoogleFileInfo(subject.link) && extractGoogleFileInfo(subject.link).id !== null ? (

                            <DocPreview
                                doc={extractGoogleFileInfo(subject.link)}
                            >

                                {(isOpen) =>
                                    <button className={`p-2 rounded-xl cursor-pointer ${isOpen ? 'bg-background5' : null} hover:bg-background5 transition-colors duration-200`}>
                                        <FaEye className="text-sm"/>
                                    </button>                            
                                }

                            </DocPreview>

                        ) : (

                            <a href={formatUrl(subject.link)} target="_blank">
                                <button className={`p-2 rounded-xl cursor-pointer hover:bg-background5 transition-colors duration-200`}>
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
                            <button className={`p-2 rounded-xl cursor-pointer ${isOpen ? 'bg-background5' : null} hover:bg-background5 transition-colors duration-200`}>
                                <FaEllipsisV className="text-sm"/>
                            </button>
                        }
                    </Dropdown>                    
                </div>
  
            </div>

        </Card>

    )

}

export default Subject