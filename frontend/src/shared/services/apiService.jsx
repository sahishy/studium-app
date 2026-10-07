import { auth } from '../../lib/firebase'

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

const request = async ({ path, method = 'GET', body = null, headers = {} }) => {
    const user = await waitForAuthUser()
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

    const data = await response.json().catch(() => ({}))

    if(!response.ok) {
        throw new Error(data?.error || `Request failed: ${response.status}`)
    }

    return data
}

const post = (path, body = {}) => request({ path, method: 'POST', body })
const remove = (path) => request({ path, method: 'DELETE' })

export {
    request,
    post,
    remove,
}
