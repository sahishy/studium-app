import { useOutletContext } from 'react-router-dom'
import Header from '../../components/main/Header.jsx'
import Subject from '../../components/agenda/Subject.jsx'
import { useSubjects } from '../../contexts/SubjectsContext.jsx'
import { useModal } from '../../contexts/ModalContext.jsx'
import { FaPlus } from 'react-icons/fa'
import SubjectModal from '../../components/modals/SubjectModal.jsx'
import Button from '../main/Button.jsx'
import BottomFade from '../main/BottomFade.jsx'
import BottomPadding from '../main/BottomPadding.jsx'

const Subjects = () => {

    const { profile } = useOutletContext()
    const { user: userSubjects } = useSubjects()

    return (
        <div className="flex flex-col h-full relative">
            <div className="flex-1 overflow-y-auto relative">
                <Header text={'Subjects'} profile={profile}/>

                <div className='w-full h-full flex flex-col gap-4 px-24 pb-8 pt-2 m-auto'>

                    <div className='flex flex-col gap-4'>

                        <div className='flex gap-2'>
                            <AddSubjectButton profile={profile}/>
                        </div>


                        <div className='w-full grid grid-cols-3 auto-rows-auto gap-4'>
                            {userSubjects.sort((a, b) => new Date(a.createdAt.seconds) - new Date(b.createdAt.seconds)).map((subject) => (
                                <Subject key={subject.uid} subject={subject}/>
                            ))}
                        </div>

                    </div>

                </div>
                <BottomPadding/>
            </div>
            <BottomFade/>
        </div>
    )
}

const AddSubjectButton = ( { profile } ) => {

    const { openModal, closeModal } = useModal()

    const handleClick = () => {
        const subjectData = {
            title: '',
            day: 'A',
            color: 'gray',
            link: ''
        }
        openModal(<SubjectModal userId={profile.uid} isEdit={false} subjectData={subjectData} closeModal={closeModal}/>)
    }

    return (
        <Button onClick={handleClick} type={'secondary'}>
            Add Subject
        </Button>
    )
}

export default Subjects