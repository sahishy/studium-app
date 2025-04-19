import { useState, useEffect } from 'react'
import { auth } from '../../lib/firebase'
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { getDoc, setDoc, doc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

import { FaGoogle } from "react-icons/fa";
import { FaCircleExclamation } from "react-icons/fa6";
import { createNewUserObject } from '../../utils/userUtils'


const Login = () => {

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [firebaseError, setFirebaseError] = useState({})
    const [errors, setErrors] = useState({})
    const navigate = useNavigate()
    const { user } = useAuth()
  
    useEffect(() => {

        if(user) {
            navigate('/')
        }

    }, [user, navigate])
  
    const handleLogin = async (e) => {

        e.preventDefault()
        
        if(validateForm()) {
            try {
                await signInWithEmailAndPassword(auth, email, password)
                navigate('/')
            } catch (err) {
                setFirebaseError(err)
            }            
        }
 
    }


    const handleGoogleContinue = async () => {

        const provider = new GoogleAuthProvider()
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        try {
            const res = await signInWithPopup(auth, provider)
            const user = res.user

            const userRef = doc(db, 'users', user.uid)
            const userSnap = await getDoc(userRef)

            if(!userSnap.exists()) {
                const [firstName, ...rest] = user.displayName.split(' ')
                const lastName = rest.join(' ') || ''

                await setDoc(userRef, createNewUserObject( {uid: user.uid, firstName: firstName, lastName: lastName, email: user.email}))
            }

            const emailProvider = new EmailAuthProvider();
            const credential = emailProvider.credential(user.email, password);
            try {
                await linkWithCredential(user, credential)
                //console.log("successfully linked google to email/password.")
            } catch(err) {
                //console.log("account is already linked")
            }

            navigate('/dashboard')
        } catch (err) {
            setFirebaseError(err)
        }

    }

    const validateForm = () => {
        let isValid = true;
        const newErrors = {};
    
        if(email === '') {
            newErrors.email = 'Email is required';
            isValid = false;
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Email is invalid';
            isValid = false;
        }

        if(password === '') {
            newErrors.password = 'Password is required';
            isValid = false;
        } else if(password.length < 8) {
            newErrors.password = 'Password is too short';
            isValid = false;
        }
        
        setErrors(newErrors);
        return isValid;
    };

    const formatFirebaseError = () => {
        let message = 'An unexpected error occurred. Please try again.';
        switch(firebaseError.code) {

            case 'auth/invalid-credential':
                message = 'The provided email or password is incorrect. Please try again.'
                break;

        }
        return message;
    }

    return (
        <div className="h-screen flex justify-center items-center bg-gray-50">

            <div className="h-full w-full max-w-5xl">

                <header className="w-full max-w-5xl flex justify-between items-center p-4">
                    <button 
                        className='"w-full max-w-5xl flex items-center gap-2 py-[4px] cursor-pointer'
                        onClick={() => navigate('/')}
                    >
                        <img src="/favicon.ico" alt="Logo" className="w-8 h-8"/>
                        <h2 className="text-lg font-extrabold">Studium</h2>
                    </button>
                </header>


                <div className="flex flex-col gap-8 p-8 max-w-lg bg-white border-2 border-gray-200 rounded-lg mx-auto mt-2">

                    <h2 className="text-2xl font-extrabold text-center">Welcome Back</h2>

                    <form onSubmit={handleLogin} noValidate={true} className="space-y-4">

                        <div className='flex flex-col gap-2'>
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={`w-full p-4 border-2 rounded-lg focus:outline-yellow-400 ${errors.email ? 'border-red-400' : 'border-gray-200'}`}
                            />
                            {errors.email && <p className='text-red-400 flex items-center gap-2'><FaCircleExclamation/>{errors.email}</p>}
                        </div>

                        <div className='flex flex-col gap-2'>
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`w-full p-4 border-2 rounded-lg focus:outline-yellow-400 ${errors.email ? 'border-red-400' : 'border-gray-200'}`}
                            />
                            {errors.password && <p className='text-red-400 flex items-center gap-2'><FaCircleExclamation/>{errors.password}</p>}
                        </div>

                        {firebaseError.code && <p className="text-red-400 flex justify-center items-center gap-2"><FaCircleExclamation/>{formatFirebaseError()}</p>}

                        <button className="w-full p-4 font-extrabold border-yellow-500 border-b-4 rounded-lg bg-yellow-400 hover:bg-yellow-500 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200">
                            Log In
                        </button>

                        <div className='flex items-center gap-2'>
                            <hr className='flex-1 border-1 border-gray-200 rounded-full'></hr>
                            <p className='text-gray-400 font-extrabold'>OR</p>
                            <hr className='flex-1 border-1 border-gray-200 rounded-full'></hr>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleContinue}
                            className="w-full p-4 text-white font-extrabold border-black border-b-4 rounded-lg bg-gray-800 hover:bg-black active:translate-y-[2px] active:mb-[18px] active:border-b-2 cursor-pointer transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            <FaGoogle/>
                            Continue with Google
                        </button>
                        
                        <p className="text-center text-gray-500 flex justify-center">
                            Don't have an account?&nbsp;
                            <a
                                onClick={() => navigate('/signup')}
                                className="text-yellow-400 font-extrabold group transition-all cursor-pointer"
                            >
                                Sign Up
                                <span className="block max-w-0 group-hover:max-w-full transition-all duration-200 h-0.5 bg-yellow-400"></span>
                            </a>
                        </p>

                    </form>

                    <p className='text-sm text-gray-400 text-center'>Note: Some schools may block Google sign-ins or account creation. If you're experiencing this, please use the regular log-in method instead.</p>
            
                </div>

            </div>

        </div>
    )
}

export default Login