const API_BASE_URL = import.meta.env.VITE_BACKEND_API_BASE_URL

const buildUrl = (path) => {
    if(!API_BASE_URL) {
        throw new Error('VITE_BACKEND_API_BASE_URL is not configured.')
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${API_BASE_URL}${normalizedPath}`
}

const request = async ({ path, method = 'GET', body = null, headers = {} }) => {
    const response = await fetch(buildUrl(path), {
        method,
        headers: {
            ...(body ? { 'Content-Type': 'application/json' } : {}),
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

export {
    request,
    post,
}
