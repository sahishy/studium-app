import { onDisconnect, onValue, ref, serverTimestamp, set } from 'firebase/database'
import { rtdb } from '../../../lib/firebase'

const statusRef = (uid) => ref(rtdb, `status/${uid}`)

const startPresence = (uid) => onValue(ref(rtdb, '.info/connected'), (snapshot) => {
    if(snapshot.val() !== true) return
    onDisconnect(statusRef(uid)).set({ state: 'offline', lastChanged: serverTimestamp() }).then(() => {
        set(statusRef(uid), { state: 'online', lastChanged: serverTimestamp() })
    })
})

const stopPresence = (uid) => set(statusRef(uid), { state: 'offline', lastChanged: serverTimestamp() })

export { startPresence, stopPresence }
