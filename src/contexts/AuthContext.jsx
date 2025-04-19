import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, db } from '../lib/firebase'
import { getDoc, doc } from 'firebase/firestore'

const AuthContext = createContext()

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
                if (profileSnap.exists()) {
                setProfile(profileSnap.data())
                } else {
                setProfile(null)
                }
            } else {
                setProfile(null)
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