import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { FaArrowLeft, FaCircleExclamation } from 'react-icons/fa6'
import { auth, db } from '../../../lib/firebase'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import ProgressBar from '../../../shared/components/ui/ProgressBar'
import { useModal } from '../../../shared/contexts/ModalContext'
import logoSmall from '../../../assets/images/logo_sm.png'
import googleIcon from '../../../assets/images/google.svg'
import { createNewUserObject } from '../services/userService'
import { createUserStatsDocument } from '../../profile/services/statsService'
import { uploadProfilePicture } from '../../../shared/services/storageService'
import { getSchools } from '../../profile/services/schoolService'
import { getSchoolNameById } from '../../courses/utils/reviewUtils'
import LogInModal from '../components/modals/LogInModal'

const TOTAL_STEPS = 5

const Welcome = () => {

    const navigate = useNavigate()
    const { openModal } = useModal()

    const schools = useMemo(
        () => getSchools()
            .filter((school) => school?.highSchoolId !== 'LCPS-000')
            .sort((a, b) => (a?.name || '').localeCompare(b?.name || '', undefined, { sensitivity: 'base' })),
        []
    )

    const [step, setStep] = useState(1)
    const [selectedCounty, setSelectedCounty] = useState(null)
    const [selectedSchoolId, setSelectedSchoolId] = useState(null)
    const [attendsAcademies, setAttendsAcademies] = useState(null)

    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [firebaseError, setFirebaseError] = useState({})
    const [errors, setErrors] = useState({})

    const getCanContinue = () => {
        switch (step) {
            case 1:
                return true
            case 2:
                return Boolean(selectedCounty)
            case 3:
                return Boolean(selectedSchoolId)
            case 4:
                return attendsAcademies !== null
            default:
                return false
        }
    }

    const handleContinue = () => {
        if (step === 2 && selectedCounty === 'other') {
            window.alert('Most Studium features currently rely on Loudoun County Public Schools data. Please come back when support expands.')
            return
        }

        if (step < 5) {
            setStep((previous) => previous + 1)
        }
    }

    const handleBack = () => {
        if (step === 1) {
            navigate('/')
            return
        }

        setStep((previous) => Math.max(1, previous - 1))
    }

    const getStatsPayload = () => ({
        schoolId: selectedSchoolId,
        schoolAffiliations: attendsAcademies ? ['LCPS-000'] : [],
    })

    const validateForm = () => {
        let isValid = true
        const newErrors = {}

        if (firstName === '') {
            newErrors.firstName = 'First name is required'
            isValid = false
        }

        if (lastName === '') {
            newErrors.lastName = 'Last name is required'
            isValid = false
        }

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

        if (!validateForm()) {
            return
        }

        try {
            const res = await createUserWithEmailAndPassword(auth, email, password)
            const user = res.user
            const userRef = doc(db, 'users', user.uid)

            const newUserObject = await createNewUserObject({
                firstName,
                lastName,
                email: res.user.email,
            })

            await setDoc(userRef, newUserObject)
            await createUserStatsDocument({ userId: user.uid, ...getStatsPayload() })
            await uploadProfilePicture({
                uid: user.uid,
                profileForThumbnail: newUserObject,
            })

            navigate('/agenda')
        } catch (err) {
            setFirebaseError(err)
        }
    }

    const handleGoogleContinue = async () => {
        const provider = new GoogleAuthProvider()
        provider.setCustomParameters({ prompt: 'select_account' })

        try {
            const res = await signInWithPopup(auth, provider)
            const user = res.user

            const userRef = doc(db, 'users', user.uid)
            const userSnap = await getDoc(userRef)

            if (!userSnap.exists()) {
                const [nextFirstName, ...rest] = (user.displayName || '').split(' ')
                const nextLastName = rest.join(' ') || ''

                const newUserObject = await createNewUserObject({
                    firstName: nextFirstName,
                    lastName: nextLastName,
                    email: user.email,
                })

                await setDoc(userRef, newUserObject)
                await createUserStatsDocument({ userId: user.uid, ...getStatsPayload() })
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

    const openLogInModal = () => {
        openModal(
            <LogInModal onSwitchToSignUp={() => navigate('/welcome')} />
        )
    }

    return (
        <div className='relative min-h-screen text-neutral0 flex flex-col items-center py-8'>

            <div className='w-full max-w-3xl flex items-center gap-3'>
                <Button
                    type='tertiary'
                    onClick={handleBack}
                    className='p-2!'
                >
                    <FaArrowLeft />
                </Button>
                <ProgressBar
                    value={step}
                    max={TOTAL_STEPS}
                    className='h-2'
                />
            </div>

            <div className='mx-auto w-full flex items-start justify-center py-24 flex-1'>

                {step === 1 && (
                    <section className='self-center mb-28 flex h-full flex-col items-center justify-center gap-6 text-center'>
                        <img src={logoSmall} alt='Studium' className='h-10 w-10 object-contain' />
                        <div>
                            <h1 className='text-3xl font-bold'>Welcome to Studium</h1>
                            <p className='mt-3 text-neutral1'>Let's personalize your account in a few quick steps.</p>
                        </div>
                    </section>
                )}

                {step === 2 && (
                    <section className='self-center mb-28 flex flex-col items-center gap-8'>

                        <div className='flex items-center gap-6'>
                            <img src={logoSmall} alt='Studium' className='h-6 w-6 object-contain' />
                            <h2 className='text-2xl font-semibold'>Which county do you attend?</h2>
                        </div>

                        <div className='grid grid-cols-2 gap-6'>
                            <SelectableCard
                                selected={selectedCounty === 'lcps'}
                                onClick={() => setSelectedCounty('lcps')}
                            >
                                <div className='rounded-xl bg-neutral5 h-32'>

                                </div>
                                <div>
                                    <p className='font-semibold text-sm'>Loudoun County Public Schools</p>
                                    <p className='text-neutral1 text-sm'>Virginia</p>
                                </div>
                            </SelectableCard>
                            <SelectableCard
                                selected={selectedCounty === 'other'}
                                onClick={() => setSelectedCounty('other')}
                            >
                                <div className='rounded-xl bg-neutral5 h-32'>

                                </div>
                                <div>
                                    <p className='font-semibold text-neutral1'>Other</p>
                                    {/* <p className='text-neutral1 text-sm'></p> */}
                                </div>
                            </SelectableCard>
                        </div>
                    </section>
                )}

                {step === 3 && (
                    <section className='w-full flex flex-col items-center gap-8 pb-24'>

                        <div className='flex items-center gap-6'>
                            <img src={logoSmall} alt='Studium' className='h-6 w-6 object-contain' />
                            <h2 className='text-2xl font-semibold'>What school do you go to?</h2>
                        </div>

                        <div className='w-full max-w-4xl grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
                            {schools.map((school) => (
                                <SelectableCard
                                    key={school.highSchoolId}
                                    selected={selectedSchoolId === school.highSchoolId}
                                    onClick={() => setSelectedSchoolId(school.highSchoolId)}
                                >
                                    <div className='rounded-xl bg-neutral5 h-32'>

                                    </div>
                                    <div>
                                        <p className='font-semibold text-sm'>{school.name}</p>
                                        <p className='text-neutral1 text-sm'>{school.city}</p>
                                    </div>
                                </SelectableCard>
                            ))}
                        </div>
                    </section>
                )}

                {step === 4 && (
                    <section className='flex flex-col gap-8'>

                        <div className='flex items-center gap-6'>
                            <img src={logoSmall} alt='Studium' className='h-6 w-6 object-contain' />
                            <h2 className='text-2xl font-semibold'>Do you attend the Academies of Loudoun?</h2>
                        </div>

                        <div className='flex flex-col gap-3 items-start'>
                            <SelectableCard
                                selected={attendsAcademies === true}
                                onClick={() => setAttendsAcademies(true)}
                            >
                                <p className='font-semibold text-sm'>Yes, I attend the academies.</p>
                            </SelectableCard>
                            <SelectableCard
                                title={`No, just ${getSchoolNameById(selectedSchoolId)}.`}
                                selected={attendsAcademies === false}
                                onClick={() => setAttendsAcademies(false)}
                            >
                                <p className='font-semibold text-sm'>{`No, just ${getSchoolNameById(selectedSchoolId)}.`}</p>
                            </SelectableCard>
                        </div>

                    </section>
                )}

                {step === 5 && (
                    <section className='flex flex-col items-center gap-8'>

                        <img src={logoSmall} alt='Studium' className='h-10 w-10 object-contain' />

                        <div className='flex flex-col items-center'>
                            <h2 className='text-2xl font-bold'>Create your free account</h2>
                            <p className='mt-2 text-neutral1'>You're one step away from getting started.</p>
                        </div>

                        <form onSubmit={handleSignup} noValidate className='flex flex-col gap-4'>
                            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                                <div className='flex flex-col gap-1.5'>
                                    <input
                                        type='text'
                                        placeholder='First Name'
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className='w-full rounded-full bg-neutral5 px-4 py-3 text-sm outline-neutral3 transition-colors'
                                        autoComplete='given-name'
                                        name='firstName'
                                    />
                                    {errors.firstName && <p className='flex items-center gap-2 text-xs text-red-400'><FaCircleExclamation />{errors.firstName}</p>}
                                </div>

                                <div className='flex flex-col gap-1.5'>
                                    <input
                                        type='text'
                                        placeholder='Last Name'
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className='w-full rounded-full bg-neutral5 px-4 py-3 text-sm outline-neutral3 transition-colors'
                                        autoComplete='family-name'
                                        name='lastName'
                                    />
                                    {errors.lastName && <p className='flex items-center gap-2 text-xs text-red-400'><FaCircleExclamation />{errors.lastName}</p>}
                                </div>
                            </div>

                            <div className='flex flex-col gap-1.5'>
                                <input
                                    type='email'
                                    placeholder='Email'
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className='w-full rounded-full bg-neutral5 px-4 py-3 text-sm outline-neutral3 transition-colors'
                                    autoComplete='email'
                                    name='email'
                                />
                                {errors.email && <p className='flex items-center gap-2 text-xs text-red-400'><FaCircleExclamation />{errors.email}</p>}
                            </div>

                            <div className='flex flex-col gap-1.5'>
                                <input
                                    type='password'
                                    placeholder='Password'
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className='w-full rounded-full bg-neutral5 px-4 py-3 text-sm outline-neutral3 transition-colors'
                                    name='password'
                                    autoComplete='new-password'
                                />
                                {errors.password && <p className='flex items-center gap-2 text-xs text-red-400'><FaCircleExclamation />{errors.password}</p>}
                            </div>

                            {firebaseError.code && <p className='flex items-center justify-center gap-2 text-xs text-red-400'><FaCircleExclamation />{formatFirebaseError()}</p>}

                            <Button htmlType='submit' type='primary' className='w-full rounded-full py-3'>
                                Create account
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

                        <p className='text-center text-sm text-neutral1'>
                            Already have an account?{' '}
                            <span
                                onClick={openLogInModal}
                                className='cursor-pointer font-semibold text-neutral0 hover:opacity-80 transition'
                            >
                                Log In
                            </span>
                        </p>

                    </section>
                )}
            </div>

            {step < 5 && (
                <>
                    <div className='pointer-events-none fixed inset-x-0 bottom-0 h-64 bg-gradient-to-t from-neutral6 to-transparent z-10' />

                    <div className='w-full max-w-sm fixed bottom-16 left-1/2 z-20 -translate-x-1/2 flex'>
                        <Button
                            type='primary'
                            onClick={handleContinue}
                            disabled={!getCanContinue()}
                            className='flex-2 rounded-full py-4'
                        >
                            Continue
                        </Button>
                    </div>
                </>
            )}

        </div>
    )
}

const SelectableCard = ({ selected, onClick, children }) => {
    return (
        <Card
            onClick={onClick}
            className={`cursor-pointer transition-all outline-neutral3 ${selected
                ? 'outline-2'
                : 'hover:bg-neutral5'
                }`}
        >
            {children}
        </Card>
    )
}

export default Welcome