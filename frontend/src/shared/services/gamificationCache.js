import { createCacheKey, deleteCacheEntriesByPrefix, getCacheEntry, isCacheEntryStale, setCacheEntry } from './cacheService.jsx'
import { CACHE_NAMESPACES, CACHE_TTLS_MS } from '../utils/cacheUtils.jsx'

const pending = new Map()
const prefixFor = (userId) => createCacheKey(CACHE_NAMESPACES.GAMIFICATION, `${encodeURIComponent(userId)}:`)

const policyFor = (path) => {
    const endpoint = path.split('?')[0]
    if(endpoint === '/v1/economy') return { ttlMs: CACHE_TTLS_MS.ECONOMY, valid: value => Boolean(value?.wallet && value?.progress && Array.isArray(value?.catalog)) }
    if(endpoint === '/v1/mastery') return { ttlMs: CACHE_TTLS_MS.MASTERY, valid: value => Array.isArray(value?.domains) }
    if(endpoint.startsWith('/v1/mastery/matches/')) return { ttlMs: CACHE_TTLS_MS.MATCH_MASTERY, valid: value => Boolean(value?.comparison) && !value?.pending }
    if(endpoint === '/v1/streak') return { ttlMs: CACHE_TTLS_MS.STREAK, valid: value => Boolean(value?.dayKey) && Array.isArray(value?.week), daily: true }
    return null
}

// A daily board must never reuse yesterday's response, even within its TTL.
const dayKey = () => {
    const now = new Date()
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
}

const invalidateGamificationCache = (userId, endpoints = null) => {
    const prefix = prefixFor(userId)
    const prefixes = endpoints ? endpoints.map(endpoint => `${prefix}${endpoint}`) : [prefix]
    prefixes.forEach(value => {
        deleteCacheEntriesByPrefix(value)
        // Detach older requests so they cannot refill an invalidated cache.
        for(const key of pending.keys()) if(key.startsWith(value)) pending.delete(key)
    })
}

const clearGamificationCache = () => {
    deleteCacheEntriesByPrefix(`${CACHE_NAMESPACES.GAMIFICATION}:`)
    pending.clear()
}

const readGamificationCache = ({ userId, path, fresh = false, fetchData }) => {
    const policy = policyFor(path)
    if(!userId || !policy) return fetchData()
    const key = `${prefixFor(userId)}${path}${policy.daily ? `:${dayKey()}` : ''}`
    if(!fresh) {
        const entry = getCacheEntry(key)
        if(entry && !isCacheEntryStale(key)) return Promise.resolve(entry.value)
        if(pending.has(key)) return pending.get(key)
    }
    // Forced reads supersede any older request, including one started before a mutation.
    const promise = Promise.resolve().then(fetchData).then(value => {
        if(pending.get(key) === promise && policy.valid(value)) setCacheEntry(key, value, { ttlMs: policy.ttlMs })
        return value
    }).finally(() => {
        if(pending.get(key) === promise) pending.delete(key)
    })
    pending.set(key, promise)
    return promise
}

// These writes can grant XP, Lumen, cosmetics or quest/streak rewards. Mutations
// always reach the server; only subsequent reads are cached.
const invalidateGamificationMutation = (userId, path) => {
    if(/^\/v1\/(economy|quests|streak|tasks|resources|college-posts|onboarding|dev)(\/|$)/.test(path)
        || /^\/v1\/circles\/[^/]+\/grand-quest\/claim$/.test(path)) {
        invalidateGamificationCache(userId)
    }
}

export { readGamificationCache, invalidateGamificationCache, invalidateGamificationMutation, clearGamificationCache }
