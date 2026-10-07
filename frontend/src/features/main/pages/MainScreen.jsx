import { Outlet } from 'react-router-dom'
import Sidebar from '../../../shared/components/ui/Sidebar'
import { useState, useEffect } from 'react'
import { useAuth } from '../../auth/contexts/AuthContext'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { CirclesProvider } from '../../socials/contexts/CirclesContext'
import { MembersProvider } from '../../socials/contexts/MembersContext'
import { FriendsProvider } from '../../socials/contexts/FriendsContext'
import { TasksProvider } from '../../agenda/contexts/TasksContext'
import { EconomyProvider } from '../../economy/EconomyContext'
import { RewardFxProvider } from '../../economy/RewardFxContext'
import { QuestProvider } from '../../quests/QuestContext'
import { CoursesProvider } from '../../courses/contexts/CoursesContext'
import { UserStatsProvider } from '../../profile/contexts/UserStatsContext'
import { MultiplayerProvider } from '../../multiplayer/contexts/MultiplayerContext'
import LoadingState from '../../../shared/components/ui/LoadingState'
import { FaBars, FaXmark } from 'react-icons/fa6'

const MainScreenLayout = ({ profile }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    return (
        <>
            <div className="flex min-h-screen">

                <Sidebar profile={profile} />

                <button type='button' aria-label='Open navigation' onClick={() => setMobileMenuOpen(true)} className='fixed left-4 top-5 z-50 rounded-lg bg-neutral5 p-2 text-neutral1 lg:hidden'><FaBars /></button>
                {mobileMenuOpen && <div className='fixed inset-0 z-[60] lg:hidden'><button type='button' aria-label='Close navigation' onClick={() => setMobileMenuOpen(false)} className='absolute inset-0 bg-black/35' /><div className='relative h-full w-56'><Sidebar profile={profile} mobile onNavigate={() => setMobileMenuOpen(false)} /><button type='button' aria-label='Close navigation' onClick={() => setMobileMenuOpen(false)} className='absolute right-2 top-2 rounded-lg p-2 text-neutral1'><FaXmark /></button></div></div>}

                <main className="relative min-w-0 flex-1 h-screen max-w-[2560px] mx-auto overflow-x-hidden">

                    {/* <div className='absolute w-full h-full opacity-[0.067] z-[-1]'>
                        <img
                            src='https://m.media-amazon.com/images/I/61yoCe8remL._AC_UF894,1000_QL80_.jpg'
                            className='w-full h-full'
                        />
                    </div> */}

                    <Outlet context={{ profile }} />
                </main>

            </div>
        </>
    )
}

const MainScreen = () => {

    const { user, loading } = useAuth()
    const [profile, setProfile] = useState(null)
    const [profileLoading, setProfileLoading] = useState(true)

    useEffect(() => {

        if (!user || loading) {
            return
        }

        const docRef = doc(db, 'users', user.uid)

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setProfile({ uid: docSnap.id, ...docSnap.data() })
            } else {
                console.log('No user profile found.')
            }
            setProfileLoading(false)
        })

        return () => unsubscribe()

    }, [user, loading])

    if (profileLoading || !profile) {
        return <LoadingState fullPage />
    }

    return (
        <UserStatsProvider userId={profile?.uid}>
            <MultiplayerProvider userId={profile?.uid} profile={profile}>
                <CirclesProvider profile={profile}>
                    <FriendsProvider profile={profile}>
                        <CoursesProvider profile={profile}>
                            <MembersProvider>
                                <EconomyProvider userId={profile.uid} progressVersion={`${profile.progress?.level}:${profile.progress?.xp}`}>
                                    <RewardFxProvider>
                                        <QuestProvider userId={profile.uid}>
                                            <TasksProvider profile={profile}>
                                                <MainScreenLayout profile={profile} />
                                            </TasksProvider>
                                        </QuestProvider>
                                    </RewardFxProvider>
                                </EconomyProvider>
                            </MembersProvider>
                        </CoursesProvider>
                    </FriendsProvider>
                </CirclesProvider>
            </MultiplayerProvider>
        </UserStatsProvider>
    )
}

export default MainScreen
