import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { FaArrowLeft } from 'react-icons/fa6'
import { IoMdInformationCircleOutline } from 'react-icons/io'
import { auth, db } from '../../../lib/firebase'
import Button from '../../../shared/components/ui/Button'
import LoadingState from '../../../shared/components/ui/LoadingState'
import { useModal } from '../../../shared/contexts/ModalContext'
import logoSmall from '../../../assets/images/logo_sm.png'
import googleIcon from '../../../assets/images/google.svg'
import { createNewUserObject } from '../services/userService'
import { createUserStatsDocument } from '../../profile/services/statsService'
import { uploadProfilePicture } from '../../../shared/services/storageService'
import LogInModal from '../components/modals/LogInModal'
import { useAuthSubmission, waitForAuthPaint } from '../hooks/useAuthSubmission'



const Welcome = () => {

    const navigate = useNavigate()
    const { openModal } = useModal()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [firebaseError, setFirebaseError] = useState({})
    const [errors, setErrors] = useState({})
    const { isSubmitting, startSubmission, finishSubmission } = useAuthSubmission()

    const validateForm = () => {
        let isValid = true
        const newErrors = {}

        if (email === '') {
            newErrors.email = 'Email is required'
            isValid = false
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Email is invalid'
            isValid = false
        }

        if (password === '') {
            newErrors.password = 'Password is required'
            isValid = false
        } else if (password.length < 8) {
            newErrors.password = 'Password is too short'
            isValid = false
        }

        setErrors(newErrors)
        return isValid
    }

    const formatFirebaseError = () => {
        let message = 'An unexpected error occurred. Please try again.'
        switch (firebaseError.code) {
            case 'auth/email-already-in-use':
                message = 'The provided email is already in use'
                break
            default:
                break
        }
        return message
    }

    const handleSignup = async (e) => {
        e.preventDefault()

        if (isSubmitting || !validateForm() || !startSubmission()) {
            return
        }

        setFirebaseError({})

        try {
            await waitForAuthPaint()
            const res = await createUserWithEmailAndPassword(auth, email, password)
            const user = res.user
            const userRef = doc(db, 'users', user.uid)

            const newUserObject = await createNewUserObject({
                email: res.user.email,
            })

            await setDoc(userRef, newUserObject)
            await createUserStatsDocument({ userId: user.uid })
            await uploadProfilePicture({
                uid: user.uid,
                profileForThumbnail: newUserObject,
            })

            navigate('/play')
        } catch (err) {
            setFirebaseError(err)
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

            const userRef = doc(db, 'users', user.uid)
            const userSnap = await getDoc(userRef)

            if (!userSnap.exists()) {
                const newUserObject = await createNewUserObject({
                    email: user.email,
                })

                await setDoc(userRef, newUserObject)
                await createUserStatsDocument({ userId: user.uid })
                await uploadProfilePicture({
                    uid: user.uid,
                    profileForThumbnail: newUserObject,
                })
            }

            navigate('/play')
        } catch (err) {
            setFirebaseError(err)
            finishSubmission()
        }
    }

    const openLogInModal = () => {
        openModal(
            <LogInModal onSwitchToSignUp={() => navigate('/welcome')} />
        )
    }

    if (isSubmitting) {
        return (
            <div className="min-h-screen text-neutral0 flex flex-col items-center justify-center gap-4 px-6" aria-busy="true">
                <LoadingState className="!h-16 !min-h-0" />
                <p role="status" className="text-center text-neutral1">Setting up your account…</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen text-neutral0 flex items-center justify-center px-6 py-12">
            <section className="w-full max-w-sm flex flex-col items-center gap-6">
                <button onClick={() => navigate('/')} aria-label="Back" className="self-start size-10 flex items-center justify-center rounded-full cursor-pointer hover:bg-neutral5 motion-safe:hover:scale-105 active:scale-95 transition duration-200 focus-visible:outline-2 focus-visible:outline-neutral3"><FaArrowLeft /></button>
                <img src={logoSmall} alt="Studium" className="size-10" />
                <div className="text-center">
                    <h1 className="text-2xl font-bold">Create your free account</h1>
                    <p className="mt-2 text-neutral1">Play learning games and organize your schoolwork.</p>
                </div>
                <form onSubmit={handleSignup} noValidate className="w-full flex flex-col gap-4">
                    <input aria-label="Email" placeholder="Email" name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className="w-full rounded-full bg-neutral5 px-4 py-3 text-sm outline-neutral3 transition-colors" />
                    {errors.email && <p role="alert" className="text-red-400 text-sm">{errors.email}</p>}
                    <input aria-label="Password" placeholder="Password" name="password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className="w-full rounded-full bg-neutral5 px-4 py-3 text-sm outline-neutral3 transition-colors" />
                    {errors.password && <p role="alert" className="text-red-400 text-sm">{errors.password}</p>}
                    {firebaseError.code && <p role="alert" className="text-red-400 text-sm">{formatFirebaseError()}</p>}
                    <Button htmlType="submit" type="primary" className="w-full py-3" style={{borderRadius:9999}}>Create account</Button>
                    <div className="flex items-center gap-3"><hr className="flex-1 border-neutral4" /><p className="text-xs font-medium uppercase tracking-wide text-neutral1">or</p><hr className="flex-1 border-neutral4" /></div>
                    <Button htmlType="button" type="secondary" onClick={handleGoogleContinue} className="w-full py-3" style={{borderRadius:9999}}><img src={googleIcon} alt="" className="size-4" />Continue with Google</Button>
                </form>
                <p className="flex items-start gap-2 text-xs text-neutral1"><IoMdInformationCircleOutline className="size-4 shrink-0" aria-hidden="true" /><span>You’ll get a generated player name. You can change it anytime.</span></p>
                <p className="text-sm text-neutral1">Already have an account? <button onClick={openLogInModal} className="font-semibold text-neutral0 cursor-pointer hover:text-neutral1 transition-colors duration-200">Log In</button></p>
            </section>
        </div>
    )
}
export default Welcome
