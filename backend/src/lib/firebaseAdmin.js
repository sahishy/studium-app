import admin from 'firebase-admin'

const shouldUseEmulators = process.env.USE_FIREBASE_EMULATORS === 'true'
if(shouldUseEmulators) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
}

if(!admin.apps.length) {
    admin.initializeApp({
        projectId: 'studium-io'
    })
}

const db = admin.firestore()
const auth = admin.auth()

export { db, auth }