import { useState, useEffect } from 'react'
import { auth } from '../../../lib/firebase'
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { getDoc, setDoc, doc } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { createNewUserObject } from '../services/userService'
import { createUserStatsDocument } from '../../profile/services/statsService'
import { uploadProfilePicture } from '../../../shared/services/storageService'

import { FaGoogle } from "react-icons/fa";
import { FaCircleExclamation } from 'react-icons/fa6'

import favicon from '../../../../public/favicon.ico'

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

                const newUserObject = await createNewUserObject({ firstName: firstName, lastName: lastName, email: res.user.email })
                await setDoc(userRef, newUserObject);
                await createUserStatsDocument({ userId: user.uid })
                await uploadProfilePicture({
                    uid: user.uid,
                    profileForThumbnail: newUserObject,
                })
            
                navigate('/agenda')
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
                const [firstName, ...rest] = (user.displayName || '').split(' ')
                const lastName = rest.join(' ') || ''

                const newUserObject = await createNewUserObject({ firstName: firstName, lastName: lastName, email: user.email })
                await setDoc(userRef, newUserObject)
                await createUserStatsDocument({ userId: user.uid })
                await uploadProfilePicture({
                    uid: user.uid,
                    profileForThumbnail: newUserObject,
                })
            }
    
            navigate('/agenda')
        } catch (err) {
            setFirebaseError(err)
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
        <div className="h-screen flex justify-center items-center bg-background2">

            <div className="h-full w-full max-w-5xl">

                <header className="w-full max-w-5xl flex justify-between items-center p-4">
                    <button 
                        className='"w-full max-w-5xl flex items-center gap-2 py-[4px] cursor-pointer'
                        onClick={() => navigate('/')}
                    >
                        <img src={favicon} alt="Logo" className="w-8 h-8"/>
                        <h2 className="text-lg font-semibold">Studium</h2>
                    </button>
                </header>

                <div className="flex flex-col gap-8 p-8 max-w-lg bg-background0 border-2 border-neutral4 rounded-xl mx-auto mt-2">

                    <h2 className="text-2xl font-semibold text-center">Create Account</h2>

                    <form onSubmit={handleSignup} noValidate={true} className="space-y-4">

                        <div className='flex gap-4'>
                            <div className='flex-1 flex flex-col'>
                                <input
                                    type="text"
                                    placeholder="First Name"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full p-4 border-2 border-neutral4 rounded-xl focus:outline-yellow-400"
                                    autoComplete='given-name'
                                    name="firstName"
                                />      
                                {errors.firstName && <p className='text-red-400 flex items-center gap-2'><FaCircleExclamation/>{errors.firstName}</p>}                          
                            </div>

                            <div className='flex-1 flex flex-col'>
                                <input
                                    type="text"
                                    placeholder="Last Name"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="w-full p-4 border-2 border-neutral4 rounded-xl focus:outline-yellow-400"
                                    autoComplete='family-name'
                                    name="lastName"
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
                                className="w-full p-4 border-2 border-neutral4 rounded-xl focus:outline-yellow-400"
                                autoComplete='email'
                                name="email"
                            />
                            {errors.email && <p className='text-red-400 flex items-center gap-2'><FaCircleExclamation/>{errors.email}</p>}
                        </div>

                        <div className='flex flex-col'>
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-4 border-2 border-neutral4 rounded-xl focus:outline-yellow-400"
                                name="password"
                                autoComplete='new-password'
                            />
                            {errors.password && <p className='text-red-400 flex items-center gap-2'><FaCircleExclamation/>{errors.password}</p>}
                        </div>

                        {firebaseError.code && <p className="text-red-400 flex justify-center items-center gap-2"><FaCircleExclamation/>{formatFirebaseError()}</p>}

                        <button className="w-full p-4 font-semibold border-yellow-500 border-b-4 rounded-xl bg-yellow-400 hover:bg-yellow-500 active:mt-[2px] active:border-b-2 cursor-pointer transition-all ">
                            Sign Up
                        </button>

                        <div className='flex items-center gap-2'>
                            <hr className='flex-1 border-2 border-neutral4 rounded-full'></hr>
                            <p className='text-text2 font-semibold'>OR</p>
                            <hr className='flex-1 border-2 border-neutral4 rounded-full'></hr>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleContinue}
                            className="w-full p-4 text-white font-semibold border-black border-b-4 rounded-xl bg-gray-800 hover:bg-black active:translate-y-[2px] active:mb-[18px] active:border-b-2 cursor-pointer transition-all  flex items-center justify-center gap-2"
                        >
                            <FaGoogle/>
                            Continue with Google
                        </button>

                        <p className="text-center text-gray-500 flex justify-center">
                            Already have an account?&nbsp;
                            <a
                                onClick={() => navigate('/login')} 
                                className="text-yellow-400 font-semibold group transition-all cursor-pointer"
                            >
                                Log In
                                <span className="block max-w-0 group-hover:max-w-full transition-all  h-0.5 bg-yellow-400"></span>
                            </a>
                        </p>

                    </form>

                    <p className='text-sm text-text2 text-center'>Note: Some schools may block Google sign-ins or account creation. If you're experiencing this, please use the regular sign-up method instead.</p>
                
                </div>

            </div>

        </div>
    )

}

export default Signup