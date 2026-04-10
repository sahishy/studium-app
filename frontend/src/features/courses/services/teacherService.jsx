import {
    collection,
    getDocs,
    getFirestore,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    where,
    doc,
    documentId,
    startAfter,
} from 'firebase/firestore'

const normalizeTeacherName = (value = '') => {
    return String(value ?? '').trim().replace(/\s+/g, ' ')
}

const buildTeacherQueryBase = ({ schoolId, normalizedQuery = '' }) => {
    const qBase = [
        where('schoolId', '==', String(schoolId)),
        orderBy('nameLowercase', 'asc'),
        orderBy(documentId(), 'asc'),
    ]

    if(normalizedQuery) {
        const upperBound = `${normalizedQuery}\uf8ff`
        qBase.splice(1, 0,
            where('nameLowercase', '>=', normalizedQuery),
            where('nameLowercase', '<=', upperBound)
        )
    }

    return qBase
}

const searchTeachersByName = async ({
    queryText = '',
    schoolId = null,
    limitCount = 12,
    cursor = null,
}) => {
    if(!schoolId) {
        return {
            teachers: [],
            nextCursor: null,
            hasMore: false,
        }
    }

    const normalizedQuery = normalizeTeacherName(queryText).toLowerCase()

    const db = getFirestore()
    const teachersRef = collection(db, 'schoolTeachers')
    const qBase = buildTeacherQueryBase({ schoolId, normalizedQuery })

    const queryParts = [...qBase]
    if(cursor?.nameLowercase && cursor?.id) {
        queryParts.push(startAfter(cursor.nameLowercase, cursor.id))
    }

    queryParts.push(limit(limitCount + 1))

    const scopedQuery = query(teachersRef, ...queryParts)
    const globalSnapshot = await getDocs(scopedQuery)

    const docs = globalSnapshot.docs
    const hasMore = docs.length > limitCount
    const selectedDocs = hasMore ? docs.slice(0, limitCount) : docs

    const teachers = selectedDocs.map((teacherDoc) => ({ uid: teacherDoc.id, ...teacherDoc.data() }))

    const lastDoc = selectedDocs[selectedDocs.length - 1]
    const nextCursor = hasMore && lastDoc
        ? {
            id: lastDoc.id,
            nameLowercase: String(lastDoc.data()?.nameLowercase ?? ''),
        }
        : null

    return {
        teachers,
        nextCursor,
        hasMore,
    }
}

const searchTeachersBySchoolIds = async ({
    queryText = '',
    schoolIds = [],
    limitCount = 12,
    cursor = null,
}) => {
    const normalizedSchoolIds = Array.from(new Set((schoolIds ?? []).map((id) => String(id)).filter(Boolean)))
    if(normalizedSchoolIds.length === 0) {
        return {
            teachers: [],
            nextCursor: null,
            hasMore: false,
        }
    }

    const normalizedQuery = normalizeTeacherName(queryText).toLowerCase()
    const db = getFirestore()
    const teachersRef = collection(db, 'schoolTeachers')

    const cursorBySchoolId = cursor?.bySchoolId ?? {}

    const snapshots = await Promise.all(normalizedSchoolIds.map(async (currentSchoolId) => {
        const qBase = buildTeacherQueryBase({ schoolId: currentSchoolId, normalizedQuery })
        const queryParts = [...qBase]
        const currentCursor = cursorBySchoolId[currentSchoolId]

        if(currentCursor?.nameLowercase && currentCursor?.id) {
            queryParts.push(startAfter(currentCursor.nameLowercase, currentCursor.id))
        }

        queryParts.push(limit(limitCount + 1))

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
        const schoolHasMore = docs.length > limitCount
        const selectedDocs = schoolHasMore ? docs.slice(0, limitCount) : docs

        selectedDocs.forEach((teacherDoc) => {
            mergedTeachers.push({ uid: teacherDoc.id, ...teacherDoc.data() })
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
    const teachers = dedupedTeachers.slice(0, limitCount)

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

    const db = getFirestore()
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

    const db = getFirestore()
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
    normalizeTeacherName,
    searchTeachersByName,
    searchTeachersBySchoolIds,
    createTeacher,
    getTeachersByIdsMap,
}