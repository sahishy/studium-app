import { auth } from '../../lib/firebase'
import { invalidateGamificationMutation, readGamificationCache } from './gamificationCache'

const API_BASE_URL = import.meta.env.VITE_BACKEND_API_BASE_URL

const buildUrl = (path) => {
    if(!API_BASE_URL) {
        throw new Error('VITE_BACKEND_API_BASE_URL is not configured.')
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${API_BASE_URL}${normalizedPath}`
}

let authReadyPromise = null

const waitForAuthUser = () => {

    if(auth.currentUser) {
        return Promise.resolve(auth.currentUser)
    }

    if(!authReadyPromise) {
        authReadyPromise = new Promise((resolve) => {
            const unsubscribe = auth.onAuthStateChanged((user) => {
                unsubscribe()
                authReadyPromise = null
                resolve(user)
            })
        })
    }

    return authReadyPromise
}

const fetchResponse = async ({ path, method, body, headers, user }) => {
    const token = user ? await user.getIdToken() : null
    const response = await fetch(buildUrl(path), {
        method,
        headers: {
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    })

    // A successful write may already be committed even if its response body is cut short.
    if(response.ok && method !== 'GET' && user) invalidateGamificationMutation(user.uid, path)

    // A body that is present but not JSON means the response was cut short or
    // never came from the API at all. Reading that as `{}` handed callers an
    // object that looked like a valid, empty payload - and a screen that reads
    // an absent field as "nothing here" rather than "unknown" then renders
    // confidently wrong rather than failing.
    const text = await response.text()
    let data = {}

    if(text) {
        try { data = JSON.parse(text) }
        catch {
            if(response.ok) throw new Error(`Malformed response from ${path}.`)
        }
    }

    if(!response.ok) {
        throw new Error(data?.error || `Request failed: ${response.status}`)
    }

    return data
}

// Cache only the explicitly supported gamification GET routes.
const request = async ({ path, method = 'GET', body = null, headers = {}, fresh = false }) => {
    const user = await waitForAuthUser()
    const fetchData = () => fetchResponse({ path, method, body, headers, user })
    return method === 'GET'
        ? readGamificationCache({ userId: user?.uid, path, fresh, fetchData })
        : fetchData()
}

const post = (path, body = {}) => request({ path, method: 'POST', body })
const remove = (path) => request({ path, method: 'DELETE' })

export {
    request,
    post,
    remove,
}
