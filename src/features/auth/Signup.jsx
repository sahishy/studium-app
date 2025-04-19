import { useState, useEffect } from 'react'
import { auth } from '../../lib/firebase'
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { getDoc, setDoc, doc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { createNewUserObject } from '../../utils/userUtils'

import { FaGoogle } from "react-icons/fa";
import { FaCircleExclamation } from 'react-icons/fa6'

import favicon from '../../../public/favicon.ico'

const Signup = () => {

    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
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
  
    const handleSignup = async (e) => {

        e.preventDefault()

        if(validateForm()) {
            try {
                const res = await createUserWithEmailAndPassword(auth, email, password)
                const user = res.user

                const userRef = doc(db, 'users', user.uid)
            
                await setDoc(userRef, createNewUserObject( {uid: user.uid, firstName: firstName, lastName: lastName, email: res.user.email} ));
            
                navigate('/dashboard')
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
    
                await setDoc(userRef, createNewUserObject( {uid: user.uid, firstName: firstName, lastName: lastName, email: user.email} ))
            }
    
            //try to link google account with the existing email/password account
            const emailProvider = new EmailAuthProvider();
            const credential = emailProvider.credential(user.email, password);
            try {
                await linkWithCredential(user, credential)
                console.log("Successfully linked Google to Email/Password.")
            } catch (err) {
                //account is already linked, no need to do anything
                console.log("Account is already linked.")
            }
    
            navigate('/dashboard')
        } catch (err) {
            setFirebaseError(err.message)
        }

    }

    const validateForm = () => {
        let isValid = true;
        const newErrors = {};
    
        if(firstName === '') {
            newErrors.firstName = 'First name is required'
            isValid = false;
        }

        if(lastName === '') {
            newErrors.lastName = 'Last name is required'
            isValid = false;
        }

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

            case 'auth/email-already-in-use':
                message = 'The provided email is already in use'
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
                        <img src={favicon} alt="Logo" className="w-8 h-8"/>
                        <h2 className="text-lg font-extrabold">Studium</h2>
                    </button>
                </header>

                <div className="flex flex-col gap-8 p-8 max-w-lg bg-white border-2 border-gray-200 rounded-lg mx-auto mt-2">

                    <h2 className="text-2xl font-extrabold text-center">Create Account</h2>

                    <form onSubmit={handleSignup} noValidate={true} className="space-y-4">

                        <div className='flex gap-4'>
                            <div className='flex-1 flex flex-col'>
                                <input
                                    type="text"
                                    placeholder="First Name"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full p-4 border-2 border-gray-200 rounded-lg focus:outline-yellow-400"
                                />      
                                {errors.firstName && <p className='text-red-400 flex items-center gap-2'><FaCircleExclamation/>{errors.firstName}</p>}                          
                            </div>

                            <div className='flex-1 flex flex-col'>
                                <input
                                    type="text"
                                    placeholder="Last Name"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="w-full p-4 border-2 border-gray-200 rounded-lg focus:outline-yellow-400"
                                />
                                {errors.lastName && <p className='text-red-400 flex items-center gap-2'><FaCircleExclamation/>{errors.lastName}</p>}                         
                            </div>

                        </div>
                        
                        <div className='flex flex-col'>
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full p-4 border-2 border-gray-200 rounded-lg focus:outline-yellow-400"
                            />
                            {errors.email && <p className='text-red-400 flex items-center gap-2'><FaCircleExclamation/>{errors.email}</p>}
                        </div>

                        <div className='flex flex-col'>
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-4 border-2 border-gray-200 rounded-lg focus:outline-yellow-400"
                            />
                            {errors.password && <p className='text-red-400 flex items-center gap-2'><FaCircleExclamation/>{errors.password}</p>}
                        </div>

                        {firebaseError.code && <p className="text-red-400 flex justify-center items-center gap-2"><FaCircleExclamation/>{formatFirebaseError()}</p>}

                        <button className="w-full p-4 font-extrabold border-yellow-500 border-b-4 rounded-lg bg-yellow-400 hover:bg-yellow-500 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200">
                            Sign Up
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
                            Already have an account?&nbsp;
                            <a
                                onClick={() => navigate('/login')} 
                                className="text-yellow-400 font-extrabold group transition-all cursor-pointer"
                            >
                                Log In
                                <span className="block max-w-0 group-hover:max-w-full transition-all duration-200 h-0.5 bg-yellow-400"></span>
                            </a>
                        </p>

                    </form>

                    <p className='text-sm text-gray-400 text-center'>Note: Some schools may block Google sign-ins or account creation. If you're experiencing this, please use the regular sign-up method instead.</p>
                
                </div>

            </div>

        </div>
    )

}

export default Signup