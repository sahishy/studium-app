import { Outlet } from 'react-router-dom'
import Sidebar from '../../components/main/Sidebar'
import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import ActivityHandler from './ActivityHandler'
import { CirclesProvider } from '../../contexts/CirclesContext'
import { MembersProvider } from '../../contexts/MembersContext'
import { TasksProvider } from '../../contexts/TasksContext'
import { CoursesProvider } from '../../contexts/CoursesContext'
import LoadingState from '../../components/main/LoadingState'

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

    if(profileLoading) {
        return <LoadingState fullPage label='Loading profile...' />
    }

    return (
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
    )
}

export default MainScreen