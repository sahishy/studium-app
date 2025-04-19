import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

import { PiStudentBold, PiFileBold, PiUsersThreeBold, PiCaretLeftBold, PiCaretRightBold } from "react-icons/pi";
import { FaLongArrowAltRight } from 'react-icons/fa';
import favicon from '../../../public/favicon.ico'
import pfp from '../../assets/default-profile.jpg'
import heroImage from '../../assets/hero-image.png'

import { getTotalTasksCompleted, getTotalUsers } from '../../utils/userUtils';

const Landing = () => {

    const { user, loading } = useAuth()
    const navigate = useNavigate()
  
    useEffect(() => {
        if(!loading && user) {
            navigate('/dashboard')
        }
    }, [user, loading, navigate])

    return (
        <div className="h-screen flex flex-col items-center">

            <Navbar navigate={navigate}/>
            <HeroSection navigate={navigate}/>
            <StatsSection/>
            <TestimonialsSection/>
            <CallToActionSection navigate={navigate}/>
            <Footer/>

        </div>
    )
}

const Navbar = ( { navigate } ) => {

    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {

        const handleScroll = () => {
            setScrolled(window.scrollY > 10);
        };
  
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);

    }, []);
  
    return (
        <div className={`fixed w-full flex justify-center border-gray-200 ${scrolled && 'border-b-2 bg-white'} transition-all duration-200`}>    
            <header className="w-full max-w-5xl flex justify-between items-center p-4">
                
                <div className='flex items-center gap-2'>
                    <img src={favicon} alt="Logo" className="w-8 h-8"/>
                    <h2 className="text-lg font-extrabold">Studium</h2>
                </div>

                <div className="flex gap-4 text-sm">

                    <button 
                        onClick={() => navigate('/login')}
                        className='px-4 py-2 text-white font-extrabold border-black border-b-4 rounded-lg bg-gray-800 hover:bg-black active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                    >
                        Log In
                    </button>

                    <button
                        onClick={() => navigate('/signup')}
                        className='px-4 py-2 font-extrabold border-yellow-500 border-b-4 rounded-lg bg-yellow-400 hover:bg-yellow-500 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                    >
                        Sign Up
                    </button>

                </div>
            </header>
        </div>
    )
}

const HeroSection = ( { navigate } ) => {
    return (
        <section className="w-full min-h-screen py-24 pt-[88px] bg-gray-50">
            <div className="max-w-5xl h-full m-auto flex gap-16">

                <div className='flex flex-1 flex-col justify-center gap-8'>
                    
                    <h2 className="text-6xl font-extrabold">
                        We make schoolwork&nbsp;
                        <span className='border-b-4 border-yellow-400'>fun.</span>
                    </h2>

                    <p className="text-lg text-gray-400">
                        Stay organized, motivated, and on top of your assignments — all in one intelligent planner built for students.
                    </p>

                    <div className='flex gap-4'>

                        <button 
                            onClick={() => navigate('/signup')}
                            className='px-8 py-4 font-extrabold border-yellow-500 border-b-4 rounded-lg bg-yellow-400 hover:bg-yellow-500 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                        >
                            Get Started
                        </button>

                        <button
                            onClick={() => navigate('/')}
                            className="px-8 py-4 text-white font-extrabold border-black border-b-4 rounded-lg bg-gray-800 hover:bg-black active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            Learn More
                            <FaLongArrowAltRight/>
                        </button>

                    </div>

                </div>

                <div className='flex flex-1 justify-center items-center'>
                    <img src={heroImage} alt='hero' className='w-full h-full object-contain'></img>
                </div>

            </div>
        </section>
    )
}

const StatsSection = () => {

    const [totalUsers, setTotalUsers] = useState(null)
    const [totalTasksCompleted, setTotalTasksCompleted] = useState(null)

    useEffect(() => {

        const fetchTotalUsers = async () => {
            const count = await getTotalUsers();
            setTotalUsers(count);
        }
        const fetchTotalTasksCompleted = async () => {
            const count = await getTotalTasksCompleted();
            setTotalTasksCompleted(count);
        }

        fetchTotalUsers();
        fetchTotalTasksCompleted();

    }, [])

    return (
        <section className="w-full py-24 bg-white border-2 border-gray-200">
            <div className="max-w-5xl h-full m-auto flex flex-col gap-8 text-center">

                <h2 className="text-4xl font-extrabold text-center">
                    Working Smarter Starts Here
                </h2>

                <p className="text-lg text-gray-400">
                    Studium makes planning your schoolwork effortless and rewarding. Add assignments in seconds, build daily habits, and earn XP as you get things done.
                </p>

                <div className='flex gap-8 text-left'>

                    <div className='flex-1 flex gap-4 items-center border-2 border-gray-200 p-4 rounded-lg'>
                        <PiStudentBold className='text-3xl ml-2'/>
                        <div className='flex flex-col'>
                            <h3 className='text-2xl font-extrabold'>{totalUsers ? totalUsers : 0}+</h3>
                            <p className='text-sm text-gray-400'>Students staying on track</p>
                        </div>
                    </div>

                    <div className='flex-1 flex gap-4 items-center border-2 border-gray-200 p-4 rounded-lg'>
                        <PiFileBold className='text-3xl ml-2'/>
                        <div className='flex flex-col'>
                            <h3 className='text-2xl font-extrabold'>{totalTasksCompleted ? totalTasksCompleted : 0}+</h3>
                            <p className='text-sm text-gray-400'>Assignments completed</p>
                        </div>
                    </div>

                    <div className='flex-1 flex gap-4 items-center border-2 border-gray-200 p-4 rounded-lg'>
                        <PiUsersThreeBold className='text-3xl ml-2'/>
                        <div className='flex flex-col'>
                            <h3 className='text-2xl font-extrabold'>0+</h3>
                            <p className='text-sm text-gray-400'>Focused study circles</p>
                        </div>
                    </div>


                </div>


            </div>
        </section>
    )
}

const TestimonialsSection = () => {
    return (
        <section className="w-full py-24 bg-gray-50">
            <div className="max-w-5xl h-full m-auto flex flex-col gap-16">

                <div className='flex flex-col items-center gap-4 text-center font-extrabold'>
                    <h2 className="text-lg border-b-4 border-b-yellow-400 text-gray-600">
                        TESTIMONIALS
                    </h2>

                    <h2 className="text-4xl">
                        Students Love Studium
                    </h2>
                </div>

                <div className='flex justify-between items-center gap-8'>
                    <PiCaretLeftBold className='text-4xl text-gray-600'/>

                    <div className='flex flex-col gap-8 items-center bg-white border-2 border-gray-200 p-8 rounded-lg max-w-lg'>

                        <p className="text-lg text-gray-600 text-center">
                            "Studium has revolutionized the way I approach my studies. The XP system keeps me motivated and on track!"
                        </p>

                        <div className='flex flex-col gap-2'>

                            <img src={pfp} alt='student' className='rounded-full w-16 h-16 m-auto'/>
                            <div>
                                <p className="text-2xl text-gray-600 font-extrabold text-center">
                                    Test S.
                                </p>
                                <p className="text-sm text-gray-400 text-center">
                                    11th Grade
                                </p>
                            </div>

                        </div>
                    </div>

                    <PiCaretRightBold className='text-4xl text-gray-600'/>

                </div>

            </div>
        </section>
    )
}

const CallToActionSection = ( { navigate } ) => {
    return (
        <section className="w-full py-24 bg-white border-2 border-gray-200">
            <div className="max-w-5xl h-full m-auto flex gap-16">

                <div className='flex-1 flex flex-col gap-8'>
                    <h2 className="text-4xl font-extrabold text-left">
                        Ready to Focus Better and Crush School?
                    </h2>

                    <p className="text-lg text-gray-400">
                        Studium makes planning your schoolwork effortless and rewarding. Add assignments in seconds, build daily habits, and earn XP as you get things done.
                    </p>
                </div>

                <div className='flex justify-end items-center gap-4'>

                    <button
                        onClick={() => navigate('/signup')}
                        className='px-8 py-4 font-extrabold border-yellow-500 border-b-4 rounded-lg bg-yellow-400 hover:bg-yellow-500 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                    >
                        Get Started
                    </button>

                </div>

            </div>
        </section>
    )
}

const Footer = () => {
    return (
        <section className="w-full py-24 bg-gray-800 text-white">
            <div className="max-w-5xl h-full m-auto flex justify-center gap-16">
                <p>
                    © {new Date().getFullYear()} Studium. All rights reserved.
                </p>
            </div>
        </section>
    )
}

export default Landing;