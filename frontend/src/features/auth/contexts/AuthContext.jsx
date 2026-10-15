import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '../../../lib/firebase'
import { ensureUserProfile } from '../services/userService'
import { clearGamificationCache } from '../../../shared/services/gamificationCache'
import { startPresence, stopPresence } from '../services/presenceService'

const AuthContext = createContext()

const applyThemePreference = (theme) => {
    const resolvedTheme = theme === 'dark' ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
}

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const presenceUnsubscribeRef = useRef(null)
    const presenceUidRef = useRef(null)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            clearGamificationCache()
            setUser(firebaseUser)
            setProfile(null)
            if(presenceUnsubscribeRef.current) {
                presenceUnsubscribeRef.current()
                presenceUnsubscribeRef.current = null
            }
            if(presenceUidRef.current) {
                void stopPresence(presenceUidRef.current)
                presenceUidRef.current = null
            }

            if (firebaseUser) {
                try {
                    const nextProfile = await ensureUserProfile(firebaseUser)
                    if(auth.currentUser?.uid !== firebaseUser.uid) return
                    setProfile(nextProfile)
                    applyThemePreference(nextProfile?.preferences?.theme)
                    presenceUnsubscribeRef.current = startPresence(firebaseUser.uid)
                    presenceUidRef.current = firebaseUser.uid
                } catch(error) {
                    if(auth.currentUser?.uid !== firebaseUser.uid) return
                    console.error('Could not initialize your profile', error)
                    setProfile(null)
                    applyThemePreference('light')
                }
            } else {
                setProfile(null)
                applyThemePreference('light')
            }

            setLoading(false)
        })

        return () => {
            unsubscribe()
            presenceUnsubscribeRef.current?.()
        }
    }, [])

    return (
        <AuthContext.Provider value={{ user, profile, loading, logout: () => signOut(auth) }}>
            {!loading && children}
        </AuthContext.Provider>
    )
}

const useAuth = () => useContext(AuthContext)

export {
    AuthProvider,
    useAuth
}
