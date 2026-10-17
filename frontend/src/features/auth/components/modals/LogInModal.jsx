import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth'
import { FaCircleExclamation } from 'react-icons/fa6'
import logoSmall from '../../../../assets/images/logo_sm.png'
import { auth } from '../../../../lib/firebase'
import { useModal } from '../../../../shared/contexts/ModalContext'
import Button from '../../../../shared/components/ui/Button'
import { ensureUserProfile } from '../../services/userService'
import { uploadProfilePicture } from '../../../../shared/services/storageService'
import googleIcon from '../../../../assets/images/google.svg'
import LoadingState from '../../../../shared/components/ui/LoadingState'
import { useAuthSubmission, waitForAuthPaint } from '../../hooks/useAuthSubmission'

const LogInModal = ({ onSwitchToSignUp }) => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isResettingPassword, setIsResettingPassword] = useState(false)
    const [resetSent, setResetSent] = useState(false)
    const [firebaseError, setFirebaseError] = useState({})
    const [errors, setErrors] = useState({})
    const { isSubmitting, startSubmission, finishSubmission } = useAuthSubmission()

    const navigate = useNavigate()
    const { closeModal } = useModal()

    const handleLogin = async (e) => {
        e.preventDefault()

        if (!isSubmitting && validateForm() && startSubmission()) {
            setFirebaseError({})
            try {
                await waitForAuthPaint()
                const result = await signInWithEmailAndPassword(auth, email.trim(), password)
                await ensureUserProfile(result.user)
                closeModal()
                navigate('/play')
            } catch (err) {
                setFirebaseError(err)
                finishSubmission()
            }
        }
    }

    const switchAuthView = (resetting) => {
        setIsResettingPassword(resetting)
        setResetSent(false)
        setPassword('')
        setErrors({})
        setFirebaseError({})
    }

    const handlePasswordReset = async (event) => {
        event.preventDefault()
        if (isSubmitting || !validateForm() || !startSubmission()) return
        setFirebaseError({})
        try {
            await waitForAuthPaint()
            await sendPasswordResetEmail(auth, email.trim())
            setResetSent(true)
        } catch (err) {
            // Keep the confirmation consistent whether or not this email has an account.
            if (err.code === 'auth/user-not-found') setResetSent(true)
            else setFirebaseError(err)
        } finally {
            finishSubmission()
        }
    }

    const handleGoogleContinue = async () => {
        if (!startSubmission()) return
        setFirebaseError({})

        const provider = new GoogleAuthProvider()
        provider.setCustomParameters({ prompt: 'select_account' })

        try {
            const res = await signInWithPopup(auth, provider)
            const user = res.user

            const newUserObject = await ensureUserProfile(user)

            if (!newUserObject?.profile?.profilePicture?.url) {
                await uploadProfilePicture({
                    uid: user.uid,
                    profileForThumbnail: newUserObject,
                })
            }

            closeModal()
            navigate('/play')
        } catch (err) {
            setFirebaseError(err)
            finishSubmission()
        }
    }

    const validateForm = () => {
        let isValid = true
        const newErrors = {}

        if (email.trim() === '') {
            newErrors.email = 'Email is required'
            isValid = false
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            newErrors.email = 'Email is invalid'
            isValid = false
        }

        if (!isResettingPassword && password === '') {
            newErrors.password = 'Password is required'
            isValid = false
        } else if (!isResettingPassword && password.length < 8) {
            newErrors.password = 'Password is too short'
            isValid = false
        }

        setErrors(newErrors)
        return isValid
    }

    const formatFirebaseError = () => {
        let message = 'An unexpected error occurred. Please try again.'
        switch (firebaseError.code) {
            case 'auth/invalid-credential':
                message = 'The provided email or password is incorrect. Please try again.'
                break
            case 'auth/invalid-email':
                message = 'Please enter a valid email address.'
                break
            case 'auth/too-many-requests':
                message = 'Too many attempts. Please try again later.'
                break
            case 'auth/network-request-failed':
                message = 'Check your connection and try again.'
                break
            default:
                break
        }
        return message
    }

    const handleSwitchToSignUp = () => {
        if (onSwitchToSignUp) {
            closeModal()
            onSwitchToSignUp()
        }
    }

    if (isSubmitting) {
        return (
            <div className='w-full min-h-64 flex flex-col items-center justify-center gap-4' aria-busy='true'>
                <LoadingState className='!h-16 !min-h-0' />
                <p role='status' className='text-center text-neutral1'>{isResettingPassword ? 'Sending reset link…' : 'Getting your account ready…'}</p>
            </div>
        )
    }

    return (
        <div className='w-full flex flex-col items-center gap-12'>

            <div className='flex flex-col items-center gap-2 mt-6'>
                <img src={logoSmall} alt='Studium' className='h-10 w-10 object-contain' />
                <h1 className='text-3xl font-bold'>{isResettingPassword ? (resetSent ? 'Check your email' : 'Reset password') : 'Welcome back'}</h1>
                <p role={resetSent ? 'status' : undefined} className='max-w-sm text-sm text-center text-neutral1'>
                    {isResettingPassword
                        ? (resetSent ? 'You should receive an email within the next few minutes. Follow the instructions to reset your password!' : 'Enter your email and we’ll send you a reset link.')
                        : 'Pick up where you left off and keep your streak going.'}
                </p>
            </div>

            {resetSent ? (
                <Button onClick={() => switchAuthView(false)} type='primary' className='w-full rounded-full py-3'>Back to Log In</Button>
            ) : <form onSubmit={isResettingPassword ? handlePasswordReset : handleLogin} noValidate className='w-full px-6 flex flex-col gap-4'>
                <div className='flex flex-col gap-1.5'>
                    <input
                        type='email'
                        aria-label='Email'
                        aria-invalid={Boolean(errors.email)}
                        placeholder='Email'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete='email'
                        name='email'
                        className={`w-full rounded-full bg-neutral5 px-4 py-3 text-sm outline-neutral3 transition-colors ${errors.email ? 'border-red-400' : 'border-neutral4'}`}
                    />
                    {errors.email && <p className='flex items-center gap-2 text-xs text-red-400'><FaCircleExclamation />{errors.email}</p>}
                </div>

                {!isResettingPassword && <div className='flex flex-col gap-1.5'>
                    <input
                        type='password'
                        aria-label='Password'
                        placeholder='Password'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete='current-password'
                        name='password'
                        className={`w-full rounded-full bg-neutral5 px-4 py-3 text-sm outline-neutral3 transition-colors ${errors.password ? 'border-red-400' : 'border-neutral4'}`}
                    />
                    {errors.password && <p className='flex items-center gap-2 text-xs text-red-400'><FaCircleExclamation />{errors.password}</p>}
                </div>}

                {!isResettingPassword && <button type='button' onClick={() => switchAuthView(true)} className='-translate-y-2 self-end text-xs font-semibold text-neutral1 hover:text-neutral0 cursor-pointer transition-colors'>Forgot password?</button>}

                {firebaseError.code && <p role='alert' className='flex items-center justify-center gap-2 text-xs text-red-400'><FaCircleExclamation />{formatFirebaseError()}</p>}

                <Button htmlType='submit' type='primary' className='w-full rounded-full py-3'>
                    {isResettingPassword ? 'Send reset link' : 'Log In'}
                </Button>

                {!isResettingPassword && <>
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
                </>}
                {isResettingPassword && <button type='button' onClick={() => switchAuthView(false)} className='text-sm text-neutral1 hover:text-neutral0 cursor-pointer transition-colors mt-6'>Back to Log In</button>}
            </form>}

            {!isResettingPassword && <p className='text-center text-sm text-neutral1'>
                Don't have an account?{' '}
                <span
                    onClick={handleSwitchToSignUp}
                    className='cursor-pointer font-semibold text-neutral0 hover:text-neutral1 transition'
                >
                    Sign Up
                </span>
            </p>}

        </div>
    )
}

export default LogInModal
