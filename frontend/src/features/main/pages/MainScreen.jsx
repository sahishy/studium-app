import { Outlet } from 'react-router-dom'
import Sidebar from '../../../shared/components/ui/Sidebar'
import { useState, useEffect } from 'react'
import { useAuth } from '../../auth/contexts/AuthContext'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import ActivityHandler from '../components/ActivityHandler'
import { CirclesProvider } from '../../circles/contexts/CirclesContext'
import { MembersProvider } from '../../circles/contexts/MembersContext'
import { TasksProvider } from '../../agenda/contexts/TasksContext'
import { CoursesProvider } from '../../courses/contexts/CoursesContext'
import { UserStatsProvider } from '../../profile/contexts/UserStatsContext'
import { MultiplayerProvider } from '../../multiplayer/contexts/MultiplayerContext'
import LoadingState from '../../../shared/components/ui/LoadingState'

const MainScreen = () => {
    
    const { user, loading } = useAuth()
    const [profile, setProfile] = useState(null)
    const [profileLoading, setProfileLoading] = useState(true)

    useEffect(() => {

        if(!user || loading) {
            return
        }

        const docRef = doc(db, 'users', user.uid)

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if(docSnap.exists()) {
                setProfile({ uid: docSnap.id, ...docSnap.data() })
            } else {
                console.log('No user profile found.')
            }
            setProfileLoading(false)
        })

        return () => unsubscribe()

    }, [user, loading])

    if(profileLoading || !profile) {
        return <LoadingState fullPage label='Loading profile...' />
    }

    return (
        <UserStatsProvider userId={profile?.uid}>
            <MultiplayerProvider userId={profile?.uid}>
                <CirclesProvider profile={profile}>
                    <CoursesProvider profile={profile}>
                        <MembersProvider>
                            <TasksProvider profile={profile}>

                                <ActivityHandler profile={profile}/>

                                <div className="flex min-h-screen">

                                    <Sidebar profile={profile}/>
                                    <main className="flex-1 h-screen max-w-[2560px] mx-auto">
                                        <Outlet context={{ profile }}/>
                                    </main>

                                </div>

                            </TasksProvider>
                        </MembersProvider>
                    </CoursesProvider>
                </CirclesProvider>
            </MultiplayerProvider>
        </UserStatsProvider>
    )
}

export default MainScreen