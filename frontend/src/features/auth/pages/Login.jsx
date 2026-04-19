import { useState, useEffect } from 'react'
import { auth } from '../../../lib/firebase'
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { getDoc, setDoc, doc } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { createNewUserObject } from '../services/userService'
import { createUserStatsDocument } from '../../profile/services/statsService'
import { uploadProfilePicture } from '../../../shared/services/storageService'

import { FaCircleExclamation } from "react-icons/fa6";
import Button from '../../../shared/components/ui/Button'

import logoSmall from '../../../assets/images/logo_sm.png'
import authImage from '../../../assets/images/landing/auth.jpg'
import googleIcon from '../../../assets/images/google.svg'

const Login = () => {

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [firebaseError, setFirebaseError] = useState({})
    const [errors, setErrors] = useState({})
    const navigate = useNavigate()
    const { user } = useAuth()

    useEffect(() => {

        if (user) {
            navigate('/')
        }

    }, [user, navigate])

    const handleLogin = async (e) => {

        e.preventDefault()

        if (validateForm()) {
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

            if (!userSnap.exists()) {
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

        if (email === '') {
            newErrors.email = 'Email is required';
            isValid = false;
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Email is invalid';
            isValid = false;
        }

        if (password === '') {
            newErrors.password = 'Password is required';
            isValid = false;
        } else if (password.length < 8) {
            newErrors.password = 'Password is too short';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const formatFirebaseError = () => {
        let message = 'An unexpected error occurred. Please try again.';
        switch (firebaseError.code) {

            case 'auth/invalid-credential':
                message = 'The provided email or password is incorrect. Please try again.'
                break;

        }
        return message;
    }

    return (
        <div className='min-h-screen bg-neutral6 text-neutral0 lg:flex'>
            <section className='flex min-h-screen flex-1 items-center justify-center px-6 py-10 md:px-10'>
                <div className='w-full flex flex-col items-center gap-8 max-w-sm'>

                    <img
                        src={logoSmall}
                        alt='Studium'
                        className='h-10 w-10 cursor-pointer object-contain'
                        onClick={() => navigate('/')}
                    />

                    <div className='flex flex-col items-center gap-2'>
                        <h1 className='text-3xl font-bold'>Welcome back</h1>
                        <p className='text-sm text-center text-neutral1'>
                            Pick up where you left off and keep your streak going.
                        </p>
                    </div>

                    <form onSubmit={handleLogin} noValidate={true} className='w-full flex flex-col gap-4'>
                        <div className='flex flex-col gap-1.5'>
                            <input
                                type='email'
                                placeholder='Email'
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete='email'
                                name='email'
                                className={`w-full rounded-full bg-neutral5 px-4 py-3 text-sm outline-neutral3 transition-colors ${errors.email ? 'border-red-400' : 'border-neutral4'}`}
                            />
                            {errors.email && <p className='flex items-center gap-2 text-xs text-red-400'><FaCircleExclamation />{errors.email}</p>}
                        </div>

                        <div className='flex flex-col gap-1.5'>
                            <input
                                type='password'
                                placeholder='Password'
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete='current-password'
                                name='password'
                                className={`w-full rounded-full bg-neutral5 px-4 py-3 text-sm outline-neutral3 transition-colors ${errors.password ? 'border-red-400' : 'border-neutral4'}`}
                            />
                            {errors.password && <p className='flex items-center gap-2 text-xs text-red-400'><FaCircleExclamation />{errors.password}</p>}
                        </div>

                        {firebaseError.code && <p className='flex items-center justify-center gap-2 text-xs text-red-400'><FaCircleExclamation />{formatFirebaseError()}</p>}

                        <Button htmlType='submit' type='primary' className='w-full rounded-full py-3'>
                            Log In
                        </Button>

                        <div className='flex items-center gap-3'>
                            <hr className='flex-1 border-neutral4' />
                            <p className='text-xs font-medium uppercase tracking-wide text-neutral1'>or</p>
                            <hr className='flex-1 border-neutral4' />
                        </div>

                        <Button
                            htmlType='button'
                            onClick={handleGoogleContinue}
                            type='secondary'
                            className='w-full rounded-full py-3'
                        >
                            <img src={googleIcon} alt='Google' className='h-4 w-4' />
                            Continue with Google
                        </Button>

                    </form>

                    <p className='pt-1 text-center text-sm text-neutral1'>
                        Don't have an account?{' '}
                        <span
                            onClick={() => navigate('/signup')}
                            className='cursor-pointer font-semibold text-neutral0 hover:opacity-80 transition'
                        >
                            Sign Up
                        </span>
                    </p>

                </div>
            </section>

            <section className='relative hidden min-h-screen flex-1 lg:block'>
                <img src={authImage} className='h-full w-full object-cover' />
            </section>
            
        </div>
    )
}

export default Login