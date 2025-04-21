import { useState } from 'react';
import { createSubject, getColors, updateSubject } from '../../utils/subjectUtils';

const SubjectModal = ( { userId, circleId, subject, isEdit, subjectData, closeModal } ) => {

    const [title, setTitle] = useState(subjectData.title);
    const [color, setColor] = useState(subjectData.color);
    const [link, setLink] = useState(subjectData.link);

    const handleCreate = async (e) => {

        e.preventDefault()

        const subjectData = {
            title: title,
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
                            className={`relative p-1 rounded-full border-2 ${color === colorOption.name ? 'border-gray-600' : 'border-gray-200'} cursor-pointer w-8`}
                        >
                            <div className={`absolute top-0 left-0 w-full h-full rounded-full p-2 ${colorOption.bgStyle} border-white border-4`}></div>
                            <div className="invisible pb-[100%]"></div>
                        </button>
                    ))}
                </div>

                <input
                    type="text"
                    placeholder="Title*"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-4 border-2 border-gray-200 rounded-lg focus:outline-gray-600"
                    required={true}
                />

                <input
                    type="text"
                    placeholder="Syllabus Link"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className="w-full p-4 border-2 border-gray-200 rounded-lg focus:outline-gray-600"
                />

                <div className='flex gap-4'>
                    <button
                        type='button' 
                        onClick={() => closeModal()}
                        className='w-full p-4 border-2 border-gray-200 border-b-4 rounded-lg hover:bg-gray-800/5 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                    >
                        Cancel
                    </button>

                    <button 
                        type='submit' 
                        className='w-full p-4 text-white border-black border-b-4 rounded-lg bg-gray-800 hover:bg-black active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                    >
                        {isEdit ? 'Save Changes' : 'Add'}
                    </button>
                </div>

            </form>

        </div>

    )
}

export default SubjectModal