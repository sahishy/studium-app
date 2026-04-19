import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, connectAuthEmulator, getAuth, setPersistence } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectStorageEmulator, getStorage } from 'firebase/storage'
import { getAI, GoogleAIBackend } from "firebase/ai"

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const ai = getAI(app, { backend: new GoogleAIBackend() })

const shouldUseEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
if(shouldUseEmulators) {

    connectAuthEmulator(
        auth,
        'http://127.0.0.1:9099',
        { disableWarnings: true }
    )

    connectFirestoreEmulator(
        db,
        '127.0.0.1',
        8080
    )

    connectStorageEmulator(
        storage,
        '127.0.0.1',
        9199
    )

}