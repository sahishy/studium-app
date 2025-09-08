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
        <div className="p-4 flex justify-between gap-8 bg-background0 border-2 border-border rounded-xl">

                <div className="flex items-center gap-4">
                    <div className="p-4 bg-background3 rounded-xl">
                        <FaUserGraduate className="text-2xl text-text1"/>
                    </div>

                    <div className='flex flex-col justify-center'>
                        <h1 className='text-2xl text-text1 font-extrabold'>
                            {getGreeting()}, {profile.firstName}!
                        </h1>
                        <h2 className='text-sm text-text2'>
                            Today is {getReadableDate()}.
                        </h2>
                    </div>
                </div>

                <div className='flex'>
                    <img className='h-30 object-contain' alt='greeting' src={greetingImage}></img>
                </div>

        </div>
    )

}

export default DashboardGreeting