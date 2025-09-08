import { useState } from 'react';
import { createSubject, getColors, updateSubject } from '../../utils/subjectUtils';
import { FaCircle } from 'react-icons/fa';
import Button from '../../pages/main/Button';

const SubjectModal = ( { userId, circleId, subject, isEdit, subjectData, closeModal } ) => {

    const [title, setTitle] = useState(subjectData.title);
    const [day, setDay] = useState(subjectData.day);
    const [color, setColor] = useState(subjectData.color);
    const [link, setLink] = useState(subjectData.link);

    const handleCreate = async (e) => {

        e.preventDefault()

        const subjectData = {
            title: title,
            day: day,
            color: color,
            link: link
        }

        if(isEdit) {
            updateSubject(subject.uid, subjectData);
        } else {
            if(userId) {
                createSubject( { userId: userId, subjectData: subjectData } );
            } else if(circleId) {
                createSubject( { circleId: circleId, subjectData: subjectData } );
            }
        }

        closeModal();

    }

    return (
        <div className='flex flex-col gap-8'>

            <h1 className='text-2xl font-semibold text-center'>
                {isEdit ? 'Edit Subject' : 'Add Subject'}
            </h1>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">

                <div className='flex gap-4 justify-center'>
                    {getColors().map((colorOption) => (
                        <button
                            key={crypto.randomUUID()}
                            type='button'
                            onClick={() => setColor(colorOption.name)}
                            className={`relative p-3 rounded-full border-2 ${color === colorOption.name ? 'border-text2' : 'border-border'} cursor-pointer w-8`}
                        >
                            <div className={`absolute top-0 left-0 w-full h-full rounded-full p-2 ${colorOption.bgStyle} border-border`}>
                                <FaCircle className={`absolute p-[0.4rem] w-full h-full top-0 left-0 bottom-0 right-0 ${colorOption.textStyle}`}/>
                            </div>
                            <div className="invisible pb-[100%]"></div>
                        </button>
                    ))}
                </div>

                <input
                    type="text"
                    placeholder="Title*"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-4 border-2 border-border rounded-xl focus:outline-gray-600"
                    required={true}
                />

                <div className='p-1 bg-background2 text-text1 text-center text-sm rounded-xl flex gap-1'>
                    {['A', 'B'].map((_day, index) => (
                        <button 
                            onClick={() => setDay(_day)}
                            type='button'
                            key={index}
                            className={`flex-1 px-4 py-2 rounded-xl border-2
                                ${(_day === day) ? 'bg-background1 border-border text-text1' : 'hover:bg-background5 border-transparent text-text2'}
                                transition-colors duration-200 cursor-pointer`}
                        >
                            {_day} Day
                        </button>
                    ))}
                </div>

                <input
                    type="text"
                    placeholder="Syllabus Link (Optional)"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className="w-full p-4 border-2 border-border rounded-xl focus:outline-gray-600"
                />

                <div className='flex gap-4'>
                    <Button onClick={() => closeModal()} type={'secondary'} className={'w-full py-4'}>
                        Cancel
                    </Button>

                    <Button htmlType={'submit'} type={'primary'} className={'w-full py-4'}>
                        {isEdit ? 'Save Changes' : 'Add'}
                    </Button>
                </div>

            </form>

        </div>

    )
}

export default SubjectModal