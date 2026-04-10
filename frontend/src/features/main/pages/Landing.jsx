import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/contexts/AuthContext'
import favicon from '../../../../public/favicon.ico'

const Landing = () => {

    const { user, loading } = useAuth()
    const navigate = useNavigate()
  
    useEffect(() => {
        if(!loading && user) {
            navigate('/agenda')
        }
    }, [user, loading, navigate])

    return (
        <div className="h-screen flex flex-col items-center">

            <Navbar navigate={navigate}/>

            <h1 className='mt-64'>in progress</h1>

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
        <div className={`fixed w-full flex justify-center border-neutral4 ${scrolled && 'border-b-2 bg-background0'} transition-all `}>    
            <header className="w-full max-w-5xl flex justify-between items-center p-4">
                
                <div className='flex items-center gap-2'>
                    <img src={favicon} alt="Logo" className="w-8 h-8"/>
                    <h2 className="text-lg font-semibold">Studium</h2>
                </div>

                <div className="flex gap-4 text-sm">

                    <button 
                        onClick={() => navigate('/login')}
                        className='px-4 py-2 text-white font-semibold border-black border-b-4 rounded-xl bg-gray-800 hover:bg-black active:mt-[2px] active:border-b-2 cursor-pointer transition-all '
                    >
                        Log In
                    </button>

                    <button
                        onClick={() => navigate('/signup')}
                        className='px-4 py-2 font-semibold border-yellow-500 border-b-4 rounded-xl bg-yellow-400 hover:bg-yellow-500 active:mt-[2px] active:border-b-2 cursor-pointer transition-all '
                    >
                        Sign Up
                    </button>

                </div>
            </header>
        </div>
    )
}

export default Landing;