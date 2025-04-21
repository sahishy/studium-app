import { useState } from 'react'
import { FaLongArrowAltRight } from "react-icons/fa";
import { FaUserGraduate } from "react-icons/fa";

import greetingImage from '../../assets/greeting-image.png'

const DashboardGreeting = ( { profile } ) => {

    const [date, setDate] = useState(new Date());

    const getGreeting = () => {
        
        const hours = new Date().getHours();
    
        if(hours >= 18) {
            return 'Good evening'
        } else if(hours >= 12) {
            return 'Good afternoon'
        } else {
            return 'Good morning'
        }
    
    }
    
    const getReadableDate = () => {
    
        const options = {
            weekday: 'long', 
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
    
        return date.toLocaleDateString(undefined, options);
    
    }

    return (
        <div className="p-4 flex justify-between gap-8 bg-white border-2 border-gray-200 rounded-lg">

            <div className='flex-1 flex flex-col items-start gap-4'>

                <div className="flex items-center gap-4">
                    <div className="p-4 bg-gray-100 rounded-lg">
                        <FaUserGraduate className="text-2xl text-gray-600"/>
                    </div>

                    <div className='flex flex-col justify-center'>
                        <h1 className='text-2xl text-gray-600 font-extrabold'>
                            {getGreeting()}, {profile.firstName}!
                        </h1>
                        <h2 className='text-sm text-gray-400'>
                            Today is {getReadableDate()}.
                        </h2>
                    </div>
                </div>

                <div className='flex gap-8'>

                    <div className='flex-1 flex flex-col gap-4'>
                        <p className='text-sm text-gray-400'>
                            We would love to hear any suggestions, feedback, or concerns about our app that you may have. Feel free to share your thoughts with us!
                        </p>

                        <a
                            href="https://forms.gle/45gqWVjULtn5VpuJ9"
                            target="_blank"
                        >
                            <button className='px-4 py-2 border-2 border-gray-200 border-b-4 rounded-lg flex gap-2 items-center hover:bg-gray-800/5 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'>
                                Give Feedback
                                <FaLongArrowAltRight />
                            </button>
                        </a>                      
                    </div>

                    <div className='flex'>
                        <img className='h-30 object-contain' alt='greeting' src={greetingImage}></img>
                    </div>

                </div>
            </div>
        </div>
    )

}

export default DashboardGreeting