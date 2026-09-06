import { collection, getDocs, limit, orderBy, query, startAfter } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { createCacheKey, getCacheStatus, getCacheValue, setCacheEntry, CACHE_STATUS } from '../../../shared/services/cacheService'
import { CACHE_NAMESPACES, CACHE_TTLS_MS } from '../../../shared/utils/cacheUtils'

const LEADERBOARD_FIELD_BY_ID = {
    total: 'totalElo',
    'sat-classic': 'play.sat-classic.elo',
    'sat-timber': 'play.sat-timber.elo',
    'sat-flutter': 'play.sat-flutter.elo',
    'sat-puncture': 'play.sat-puncture.elo',
}

// Only the first page (cursor: null) is cached — it's the one every tab switch re-requests.
// "Load more" pages are user-driven and one-off, so they skip the cache entirely.
const getLeaderboardPage = async (leaderboardId, { limitCount = 50, cursor = null } = {}) => {

    const field = LEADERBOARD_FIELD_BY_ID[leaderboardId]
    if(!field) throw new Error(`Unknown leaderboard: ${leaderboardId}`)

    const cacheKey = cursor ? null : createCacheKey(CACHE_NAMESPACES.LEADERBOARD_PAGE, `${leaderboardId}:${limitCount}`)
    if(cacheKey && getCacheStatus(cacheKey) === CACHE_STATUS.FRESH) {
        return getCacheValue(cacheKey)
    }

    const statsRef = collection(db, 'userStats')
    const constraints = [statsRef, orderBy(field, 'desc'), limit(limitCount)]
    if(cursor) constraints.push(startAfter(cursor))

    const snapshot = await getDocs(query(...constraints))
    const entries = snapshot.docs.map((statsDoc) => ({ uid: statsDoc.id, ...statsDoc.data() }))
    const nextCursor = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null

    const result = {
        entries,
        nextCursor,
        hasMore: snapshot.docs.length === limitCount,
    }

    if(cacheKey) setCacheEntry(cacheKey, result, { ttlMs: CACHE_TTLS_MS.LEADERBOARD_PAGE })

    return result

}

export { LEADERBOARD_FIELD_BY_ID, getLeaderboardPage }
