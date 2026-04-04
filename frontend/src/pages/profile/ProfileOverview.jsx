import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { useParams, useOutletContext, useNavigate } from 'react-router-dom'
import { db } from '../../lib/firebase'
import Topbar from '../../components/main/Topbar'
import LoadingState from '../../components/main/LoadingState'
import ErrorState from '../../components/main/ErrorState'
import AvatarModel from '../../components/avatar/AvatarModel'
import AvatarPicture from '../../components/avatar/AvatarPicture'
import background from '../../assets/images/background.jpeg'
import Button from '../../components/main/Button'
import { FaGear } from 'react-icons/fa6'

const ProfileOverview = () => {

    const navigate = useNavigate();

    const { profile: currentUserProfile } = useOutletContext()
    const { userId } = useParams()

    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!userId) {
            setLoading(false)
            return
        }

        const userRef = doc(db, 'users', userId)

        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                setProfile({ uid: docSnap.id, ...docSnap.data() })
            } else {
                setProfile(null)
            }
            setLoading(false)
        })

        return () => unsubscribe()
    }, [userId])

    const isCurrentUser = currentUserProfile.uid === userId;

    return (
        <div className='flex flex-col h-full overflow-scroll'>
            <Topbar profile={currentUserProfile} />

            <div className='w-full flex-1 flex flex-col gap-4 px-24 pb-24 pt-2'>

                {loading ? <LoadingState label='Loading profile...' /> : null}

                {!loading && !profile ? (
                    <ErrorState
                        title='Profile not found'
                        description='This user profile does not exist.'
                    />
                ) : null}

                {!loading && profile ? (
                    <section className='flex flex-col'>

                        <div className='relative w-full h-64'>
                            <div className='relative w-full h-full overflow-hidden rounded-xl bg-white'>
                                <img src={background} className='absolute opacity-40 w-full' />
                            </div>
                            <AvatarModel
                                profile={profile}
                                animation={'Idle'}
                                className='absolute w-full! h-64! top-0'
                            />
                            <div className='absolute w-36 h-36 -bottom-12 left-8 rounded-full border-8 border-neutral6'>
                                <AvatarPicture
                                    profile={profile}
                                    className='w-full h-full'
                                />
                            </div>
                        </div>

                        <div className={`flex justify-end gap-3 mt-3`}>
                            {isCurrentUser ? (
                                <>
                                    <Button
                                    >
                                        Edit Profile
                                    </Button>
                                    <Button
                                        onClick={() => navigate('/settings')}
                                        className='p-3!'
                                    >
                                        <FaGear />
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    disabled={true}
                                >
                                    Report
                                </Button>
                            )}
                        </div>

                        <div className='flex flex-col'>
                            <h1 className='text-2xl font-semibold'>
                                {profile.displayName}
                            </h1>
                        </div>

                    </section>
                ) : null}

            </div>
        </div>
    )

}

export default ProfileOverview