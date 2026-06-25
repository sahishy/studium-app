import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, db } from '../../../lib/firebase'
import { getDoc, doc } from 'firebase/firestore'

const AuthContext = createContext()

const applyThemePreference = (theme) => {
    const resolvedTheme = theme === 'dark' ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
}

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser)

            if (firebaseUser) {
                const profileRef = doc(db, 'users', firebaseUser.uid)
                const profileSnap = await getDoc(profileRef)
                if(profileSnap.exists()) {
                    const nextProfile = { uid: profileSnap.id, ...profileSnap.data() }
                    setProfile(nextProfile)
                    applyThemePreference(nextProfile?.preferences?.theme)
                } else {
                    setProfile(null)
                    applyThemePreference('light')
                }
            } else {
                setProfile(null)
                applyThemePreference('light')
            }

            setLoading(false)
        })

        return () => unsubscribe()
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