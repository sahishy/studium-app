import { collection, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where, doc, documentId, startAfter } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { normalizeTeacherName, scoreTeacherMatch } from '../utils/teacherUtils'

const buildTeacherQueryBase = ({ schoolId }) => {
    
    const qBase = [
        where('schoolId', '==', String(schoolId)),
        orderBy('nameLowercase', 'asc'),
        orderBy(documentId(), 'asc'),
    ]

    return qBase

}

const searchTeachersByName = async ({ queryText = '', schoolId = null, limitCount = 12, cursor = null }) => {

    if(!schoolId) {
        return {
            teachers: [],
            nextCursor: null,
            hasMore: false,
        }
    }

    const normalizedQuery = normalizeTeacherName(queryText).toLowerCase()

    const teachersRef = collection(db, 'schoolTeachers')
    const qBase = buildTeacherQueryBase({ schoolId })

    const pageSize = Math.max(limitCount + 1, normalizedQuery ? limitCount * 4 : limitCount + 1)
    const matchedTeachers = []

    let currentCursor = cursor
    let hasMore = false

    for(let i = 0; i < 6; i += 1) {
        const queryParts = [...qBase]
        if(currentCursor?.nameLowercase && currentCursor?.id) {
            queryParts.push(startAfter(currentCursor.nameLowercase, currentCursor.id))
        }

        queryParts.push(limit(pageSize))

        const scopedQuery = query(teachersRef, ...queryParts)
        const globalSnapshot = await getDocs(scopedQuery)
        const docs = globalSnapshot.docs

        if(docs.length === 0) {
            hasMore = false
            currentCursor = null
            break
        }

        const nextBatch = docs
            .map((teacherDoc) => ({ uid: teacherDoc.id, ...teacherDoc.data() }))
            .map((teacher) => ({ teacher, rank: scoreTeacherMatch(teacher, normalizedQuery) }))
            .filter(({ rank }) => rank >= 0)

        matchedTeachers.push(...nextBatch)

        const batchLastDoc = docs[docs.length - 1]
        currentCursor = {
            id: batchLastDoc.id,
            nameLowercase: String(batchLastDoc.data()?.nameLowercase ?? ''),
        }

        hasMore = docs.length === pageSize
        if(matchedTeachers.length >= (limitCount + 1) || !hasMore) {
            break
        }
    }

    matchedTeachers.sort((a, b) => {
        if(b.rank !== a.rank) {
            return b.rank - a.rank
        }

        const aName = String(a.teacher?.nameLowercase ?? a.teacher?.name ?? '').toLowerCase()
        const bName = String(b.teacher?.nameLowercase ?? b.teacher?.name ?? '').toLowerCase()
        if(aName < bName) return -1
        if(aName > bName) return 1
        return String(a.teacher?.uid ?? '').localeCompare(String(b.teacher?.uid ?? ''))
    })

    const hasOverflow = matchedTeachers.length > limitCount
    const teachers = matchedTeachers.slice(0, limitCount).map(({ teacher }) => teacher)
    const nextCursor = hasMore && currentCursor && (hasOverflow || teachers.length > 0)
        ? currentCursor
        : null

    return {
        teachers,
        nextCursor,
        hasMore: Boolean(nextCursor),
    }

}

const searchTeachersBySchoolIds = async ({ queryText = '', schoolIds = [], limitCount = 12, cursor = null }) => {

    const normalizedSchoolIds = Array.from(new Set((schoolIds ?? []).map((id) => String(id)).filter(Boolean)))
    if(normalizedSchoolIds.length === 0) {
        return {
            teachers: [],
            nextCursor: null,
            hasMore: false,
        }
    }

    const normalizedQuery = normalizeTeacherName(queryText).toLowerCase()
    const teachersRef = collection(db, 'schoolTeachers')

    const cursorBySchoolId = cursor?.bySchoolId ?? {}

    const snapshots = await Promise.all(normalizedSchoolIds.map(async (currentSchoolId) => {
        const qBase = buildTeacherQueryBase({ schoolId: currentSchoolId })
        const queryParts = [...qBase]
        const currentCursor = cursorBySchoolId[currentSchoolId]

        if(currentCursor?.nameLowercase && currentCursor?.id) {
            queryParts.push(startAfter(currentCursor.nameLowercase, currentCursor.id))
        }

        queryParts.push(limit(Math.max(limitCount + 1, normalizedQuery ? limitCount * 3 : limitCount + 1)))

        const scopedQuery = query(teachersRef, ...queryParts)
        const snapshot = await getDocs(scopedQuery)
        return {
            schoolId: currentSchoolId,
            docs: snapshot.docs,
        }
    }))

    const mergedTeachers = []
    const nextCursorBySchoolId = {}
    let hasMore = false

    snapshots.forEach(({ schoolId: currentSchoolId, docs }) => {
        const schoolHasMore = docs.length > Math.max(limitCount + 1, normalizedQuery ? limitCount * 3 : limitCount + 1) - 1
        const selectedDocs = docs

        selectedDocs.forEach((teacherDoc) => {
            const teacher = { uid: teacherDoc.id, ...teacherDoc.data() }
            const rank = scoreTeacherMatch(teacher, normalizedQuery)
            if(rank >= 0) {
                mergedTeachers.push({ ...teacher, _rank: rank })
            }
        })

        const lastDoc = selectedDocs[selectedDocs.length - 1]
        if(lastDoc) {
            nextCursorBySchoolId[currentSchoolId] = {
                id: lastDoc.id,
                nameLowercase: String(lastDoc.data()?.nameLowercase ?? ''),
            }
        }

        if(schoolHasMore) {
            hasMore = true
        }
    })

    mergedTeachers.sort((a, b) => {
        if((b?._rank ?? 0) !== (a?._rank ?? 0)) {
            return (b?._rank ?? 0) - (a?._rank ?? 0)
        }

        const aName = String(a?.nameLowercase ?? '').toLowerCase()
        const bName = String(b?.nameLowercase ?? '').toLowerCase()
        if(aName < bName) return -1
        if(aName > bName) return 1

        const aId = String(a?.uid ?? '')
        const bId = String(b?.uid ?? '')
        if(aId < bId) return -1
        if(aId > bId) return 1
        return 0
    })

    const dedupedTeachers = Array.from(new Map(mergedTeachers.map((teacher) => [teacher.uid, teacher])).values())
    const teachers = dedupedTeachers.slice(0, limitCount).map(({ _rank, ...teacher }) => teacher)

    return {
        teachers,
        nextCursor: hasMore ? { bySchoolId: nextCursorBySchoolId } : null,
        hasMore,
    }

}

const createTeacher = async ({ name, schoolId, createdBy }) => {
    
    const normalizedName = normalizeTeacherName(name);
    if(!normalizedName) {
        throw new Error('Teacher name is required.')
    }

    const teacherRef = doc(collection(db, 'schoolTeachers'))

    await setDoc(teacherRef, {
        name: normalizedName,
        nameLowercase: normalizedName.toLowerCase(),
        schoolId: schoolId ? schoolId : null,
        createdBy: String(createdBy),
        createdAt: serverTimestamp(),
    })

    return teacherRef.id

}

const getTeachersByIdsMap = async (teacherIds = []) => {

    const normalized = Array.from(new Set((teacherIds ?? []).map((id) => String(id)).filter(Boolean)))
    if(normalized.length === 0) {
        return {}
    }

    const teachersRef = collection(db, 'schoolTeachers')
    const results = {}

    for(let i = 0; i < normalized.length; i += 30) {
        const chunk = normalized.slice(i, i + 30)
        const q = query(teachersRef, where(documentId(), 'in', chunk))
        const snapshot = await getDocs(q)
        snapshot.docs.forEach((teacherDoc) => {
            results[teacherDoc.id] = { uid: teacherDoc.id, ...teacherDoc.data() }
        })
    }

    return results

}

export {
    searchTeachersByName,
    searchTeachersBySchoolIds,
    createTeacher,
    getTeachersByIdsMap,
}