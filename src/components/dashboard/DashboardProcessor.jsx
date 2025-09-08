import { useState, useEffect } from 'react'
import { FaCalendar, FaCircleNotch } from "react-icons/fa";
import { BsStars, BsSunriseFill } from "react-icons/bs";
import { ProcessTask } from '../../utils/aiUtils';
import { createTask } from '../../utils/taskUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useSubjects } from '../../contexts/SubjectsContext';
import Button from '../../pages/main/Button';

const DashboardProcessor = ({ profile }) => {

    const [date, setDate] = useState(new Date());

    const getGreeting = () => {

        const hours = new Date().getHours();

        if (hours >= 18) {
            return 'Good evening'
        } else if (hours >= 12) {
            return 'Good afternoon'
        } else {
            return 'Good morning'
        }

    }

    const getReadableDate = () => {

        const day = date.getDate();

        const options = {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        };

        let suffix = 'th';
        if (!(day % 100 >= 10 && day % 100 <= 19)) {
            if (day % 10 === 1) suffix = 'st';
            else if (day % 10 === 2) suffix = 'nd';
            else if (day % 10 === 3) suffix = 'rd';
        }

        return date.toLocaleDateString(undefined, options) + suffix;

    }

    return (
        <div className="flex flex-col items-center gap-8 opacity-40 
        cursor-events-none select-none cursor-not-allowed">

            <div className='flex flex-col items-center gap-2'>
                <div className='flex gap-2 text-text2 text-sm items-center'>
                    <FaCalendar />
                    <h2>
                        It's {getReadableDate()}.
                    </h2>
                </div>

                <div className='flex gap-4 items-center text-text1 font-extrabold'>
                    {/* <BsSunriseFill className='text-3xl'/> */}
                    <h1 className='text-2xl'>
                        {getGreeting()}, {profile?.firstName || 'User'}!
                    </h1>
                </div>

            </div>

            <MessageBar />

        </div>
    )

}

const MessageBar = () => {

    const { profile } = useAuth();
    const { user: userSubjects } = useSubjects();

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const [isFocused, setIsFocused] = useState(false);
    const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    const exampleMessages = [
        "Trig packet due tomorrow",
        "Finish chem notes by next class", 
        "Bio test on the 23rd",
        "Read chapter 5 for English",
        "Physics homework problems 1-20",
        "History essay rough draft",
        "Spanish vocab quiz Friday"
    ];

    useEffect(() => {

        if(!isFocused) {
            const interval = setInterval(() => {
                setIsAnimating(true);
                
                setTimeout(() => {
                    setCurrentPlaceholderIndex((prev) => 
                        (prev + 1) % exampleMessages.length
                    );
                    setIsAnimating(false);
                }, 150);
                
            }, 4000);

            return () => clearInterval(interval);
        }
        
    }, [isFocused, exampleMessages.length]);

    const handleFocus = () => {
        setIsFocused(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
    };

    const handleProcess = async () => {

        if(message === '') {
            return;
        }

        setLoading(true);
    
        const response = await ProcessTask(message, userSubjects)
        const fixedDueDate = response.dueDate ? new Date(response.dueDate + 'T23:59:59') : null;
        console.log(response)
        await createTask({ title: response.title, subject: response.subjectId, dueDate: fixedDueDate, userId: profile.uid });

        setMessage('');
        setLoading(false);

    }

    const getCurrentPlaceholder = () => {
        if(isFocused) {
            return "Describe your work";
        }
        return exampleMessages[currentPlaceholderIndex];
    };

    return (
        <div
            className={`flex gap-2 w-full p-2 rounded-xl bg-background2 shadow-lg shadow-shadow transition-all duration-200 ease-in-out 
                ${isFocused ? 'max-w-full' : 'max-w-lg'}
                cursor-events-none select-none cursor-not-allowed
                `}>
            <div className="relative w-full">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onKeyUp={(e) => {
                            if(e.key === 'Enter') {
                                handleProcess();
                                e.target.blur();
                            }
                        }}
                    // disabled={loading}
                    disabled={true}
                    className={`w-full p-4 bg-background1 border-2 border-border rounded-xl leading-0 focus:outline-none`}
                />
                
                {!message && (
                    <div className="absolute left-[18px] top-4 pointer-events-none overflow-hidden h-6">
                        <div 
                            className={`transition-transform duration-200 ease-out ${
                                isAnimating ? 'transform translate-y-6' : 'transform translate-y-0'
                            }`}
                        >
                            <div className="text-text2">
                                {getCurrentPlaceholder()}...
                            </div>
                            <div className="text-text2">
                                {exampleMessages[(currentPlaceholderIndex + 1) % exampleMessages.length]}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Button
                onClick={handleProcess}
                // disabled={loading}
                disabled={true}
                type={'primary'}
            >
                {loading ? (
                    <FaCircleNotch className='animate-spin text-lg' />
                ) : (
                    <div className='flex gap-2 items-center'>
                        <BsStars className='text-xl' />
                    </div>
                )}
            </Button>

        </div>
    )
}

export default DashboardProcessor