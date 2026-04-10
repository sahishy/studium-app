const cacheStore = new Map()

const CACHE_STATUS = {
    FRESH: 'fresh',
    STALE: 'stale',
    MISSING: 'missing'
}

const getNow = () => Date.now()

const createCacheKey = (namespace, id) => {
    return `${String(namespace)}:${String(id)}`
}

const getCacheEntry = (key) => {
    return cacheStore.get(String(key)) ?? null
}

const setCacheEntry = (key, value, options = {}) => {
    const ttlMs = Number(options?.ttlMs ?? 0)
    const fetchedAt = getNow()
    const expiresAt = ttlMs > 0 ? fetchedAt + ttlMs : null

    const entry = { value, fetchedAt, expiresAt }
    cacheStore.set(String(key), entry)
    return entry
}

const deleteCacheEntry = (key) => {
    cacheStore.delete(String(key))
}

const deleteCacheEntriesByPrefix = (prefix) => {
    const normalizedPrefix = String(prefix)
    cacheStore.forEach((_, key) => {
        if(String(key).startsWith(normalizedPrefix)) {
            cacheStore.delete(key)
        }
    })
}

const clearCache = () => {
    cacheStore.clear()
}

const getCacheMeta = (key) => {
    const entry = getCacheEntry(key)
    if(!entry) {
        return null
    }

    return {
        fetchedAt: entry.fetchedAt,
        expiresAt: entry.expiresAt,
    }
}

const isCacheEntryStale = (key, options = {}) => {
    const entry = getCacheEntry(key)
    if(!entry) {
        return true
    }

    const now = Number(options?.now ?? getNow())
    if(entry.expiresAt == null) {
        return false
    }

    return now >= entry.expiresAt
}

const getCacheValue = (key) => {
    const entry = getCacheEntry(key)
    return entry?.value
}

const getCacheStatus = (key, options = {}) => {
    const entry = getCacheEntry(key)
    if(!entry) {
        return CACHE_STATUS.MISSING
    }

    return isCacheEntryStale(key, options) ? CACHE_STATUS.STALE : CACHE_STATUS.FRESH
}

const resolveCachedRecordsByIds = (ids = [], options = {}) => {
    const keyForId = options?.keyForId ?? ((id) => String(id))
    const now = getNow()

    const freshValuesById = {}
    const staleValuesById = {}
    const missingIds = []
    const staleIds = []

    ids.forEach((rawId) => {
        const id = String(rawId)
        const key = keyForId(id)
        const status = getCacheStatus(key, { now })

        if(status === CACHE_STATUS.MISSING) {
            missingIds.push(id)
            return
        }

        const cachedValue = getCacheValue(key)
        if(status === CACHE_STATUS.FRESH) {
            freshValuesById[id] = cachedValue
            return
        }

        staleValuesById[id] = cachedValue
        staleIds.push(id)
    })

    return {
        freshValuesById,
        staleValuesById,
        missingIds,
        staleIds,
    }
}

const setCachedRecordsById = (recordsById = {}, options = {}) => {
    const keyForId = options?.keyForId ?? ((id) => String(id))
    const ttlMs = Number(options?.ttlMs ?? 0)

    Object.entries(recordsById).forEach(([id, value]) => {
        const key = keyForId(id)
        setCacheEntry(key, value, { ttlMs })
    })
}

export {
    CACHE_STATUS,
    createCacheKey,
    getCacheEntry,
    setCacheEntry,
    deleteCacheEntry,
    clearCache,
    getCacheMeta,
    isCacheEntryStale,
    getCacheValue,
    getCacheStatus,
    resolveCachedRecordsByIds,
    setCachedRecordsById,
    deleteCacheEntriesByPrefix,
}