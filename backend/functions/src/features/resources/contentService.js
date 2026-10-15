import { randomUUID } from 'node:crypto'
import { db } from '../../lib/firebaseAdmin.js'
import { readAccount, writeAccount } from '../economy/economyService.js'
import { applyQuestProgress, questDayRef, resolveDayKey } from '../quests/questService.js'
import { validateElement, validateParamShape } from './elementModel.js'
import { pack, unpack } from './firestoreArrays.js'

const RESOURCE_TYPES = new Set(['link', 'lesson'])
const MAX_PAGES = 40
const MAX_BLOCKS_PER_PAGE = 12
const MAX_VARIABLES_PER_PAGE = 6
const LINK_TYPES = new Set(['document', 'video', 'website'])
const BLOCK_TYPES = new Set(['text', 'media', 'quiz', 'interactive'])
const COLLEGE_OUTCOMES = new Set(['accepted', 'waitlisted', 'rejected', 'committed'])
const cleanText = (value, max) => String(value ?? '').trim().slice(0, max)

const validExternalUrl = (value) => {
    try {
        const url = new URL(value)
        if(!['http:', 'https:'].includes(url.protocol)) return null
        return url.toString()
    } catch { return null }
}

// Blocks are placed on a page rather than stacked, so every one carries a frame in page
// percentages — the same numbers render the page at any size, for the author and the reader.
const validateFrame = (frame) => {
    const bounded = (value, fallback) => {
        const number = Number(value)
        return Number.isFinite(number) ? Math.min(Math.max(number, 0), 100) : fallback
    }
    const width = Math.max(bounded(frame?.w, 60), 5)
    const height = Math.max(bounded(frame?.h, 40), 5)
    return { x: Math.min(bounded(frame?.x, 5), 100 - width), y: Math.min(bounded(frame?.y, 5), 100 - height), w: width, h: height }
}

const validateBlock = (block, allowIncomplete = false, variables = []) => {
    if(!BLOCK_TYPES.has(block?.type)) throw new Error('Unsupported lesson block.')
    const id = cleanText(block.id, 80) || randomUUID()
    const frame = validateFrame(block.frame)
    if(block.type === 'text') return { id, frame, type: 'text', text: cleanText(block.text, 4000) }
    if(block.type === 'media') {
        const url = validExternalUrl(block.url)
        if(!url && !(allowIncomplete && !block.url)) throw new Error('Enter a valid media URL.')
        return { id, frame, type: 'media', url: url || '', caption: cleanText(block.caption, 200) }
    }
    if(block.type === 'quiz') {
        const options = (Array.isArray(block.options) ? block.options : []).slice(0, 6).map((option) => cleanText(option, 200))
        if(!allowIncomplete && (options.length < 2 || options.some((option) => !option) || !Number.isInteger(block.answerIndex) || block.answerIndex < 0 || block.answerIndex >= options.length)) throw new Error('Quiz needs valid options and an answer.')
        return { id, frame, type: 'quiz', prompt: cleanText(block.prompt, 500), options, answerIndex: block.answerIndex, explanation: cleanText(block.explanation, 1000) }
    }
    return { id, frame, type: 'interactive', title: cleanText(block.title, 100), caption: cleanText(block.caption, 300), ...validateElement(block, allowIncomplete, variables) }
}

const validateResource = (input) => {
    const type = String(input?.type || '')
    if(!RESOURCE_TYPES.has(type)) throw new Error('Choose a resource type.')
    const title = cleanText(input.title, 120)
    if(!title) throw new Error('Add a title.')
    const base = { type, title, description: cleanText(input.description, 1200), subject: cleanText(input.subject, 80), status: input.status === 'published' ? 'published' : 'draft' }
    if(type === 'link') {
        const url = validExternalUrl(input.url)
        if((!url && !(base.status === 'draft' && !input.url)) || !LINK_TYPES.has(input.linkType)) throw new Error('Choose a link type and a valid URL.')
        return { ...base, url: url || '', linkType: input.linkType }
    }
    // A lesson is a sequence of pages the reader steps through, not one long scroll.
    const pages = (Array.isArray(input.pages) ? input.pages : []).slice(0, MAX_PAGES).map((page) => {
        // A page's variables are declared before its blocks, because every block on the page
        // may read them.
        const variables = (Array.isArray(page?.variables) ? page.variables : []).slice(0, MAX_VARIABLES_PER_PAGE).map(validateParamShape)
        return {
            id: cleanText(page?.id, 80) || randomUUID(),
            variables,
            blocks: (Array.isArray(page?.blocks) ? page.blocks : []).slice(0, MAX_BLOCKS_PER_PAGE).map((block) => validateBlock(block, base.status === 'draft', variables)),
        }
    })
    if(base.status === 'published' && !pages.some((page) => page.blocks.length)) throw new Error('Add something to a page before publishing.')
    return { ...base, pages }
}

const resourcePublicData = (doc, viewerId = null) => {
    const value = doc.data()
    if(value.status === 'deleted' || value.status === 'hidden') return null
    if(value.status !== 'published' && viewerId !== value.ownerId) return null
    // Expressions are stored with their nesting packed, so every read has to undo that.
    return { id: doc.id, ...unpack(value) }
}

// Resource cards show who made something, so author profiles are fetched once
// per distinct owner rather than per resource.
const loadAuthors = async (ownerIds = []) => {
    const distinct = [...new Set(ownerIds.filter(Boolean))]
    const users = await Promise.all(distinct.map((id) => db.collection('users').doc(id).get()))
    return new Map(users.map((user) => {
        const profile = user.data()?.profile ?? {}
        return [user.id, {
            uid: user.id,
            profile: {
                displayName: profile.displayName || 'Student',
                avatar: profile.avatar ?? null,
                profilePicture: profile.profilePicture ?? null,
                flair: profile.flair ?? null,
                title: profile.title ?? null,
            },
            progress: { level: user.data()?.progress?.level ?? 1 },
            primaryCircleId: user.data()?.primaryCircleId ?? null,
        }]
    }))
}

const listResources = async (viewerId, includeMine = false) => {
    const snap = await db.collection('resources').orderBy('updatedAt', 'desc').limit(200).get()
    const visible = snap.docs.map((doc) => resourcePublicData(doc, viewerId)).filter((value) => value && (value.status === 'published' || includeMine && value.ownerId === viewerId))
    const [hearts, authors] = await Promise.all([
        Promise.all(visible.map((value) => db.collection('resources').doc(value.id).collection('hearts').doc(viewerId).get())),
        loadAuthors(visible.map((value) => value.ownerId)),
    ])
    return visible
        .map((value, index) => ({ ...value, hearted: hearts[index].exists, author: authors.get(value.ownerId) ?? null }))
        .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0))
}

const getResource = async (id, viewerId) => {
    const doc = await db.collection('resources').doc(id).get()
    if(!doc.exists) throw new Error('Resource not found.')
    const value = resourcePublicData(doc, viewerId)
    if(!value) throw new Error('Resource not found.')
    const [heart, authors] = await Promise.all([
        doc.ref.collection('hearts').doc(viewerId).get(),
        loadAuthors([value.ownerId]),
    ])
    return { ...value, hearted: heart.exists, author: authors.get(value.ownerId) ?? null }
}

const saveResource = async (userId, input) => {
    const data = validateResource(input)
    const ref = input.id ? db.collection('resources').doc(String(input.id)) : db.collection('resources').doc()
    return db.runTransaction(async (transaction) => {
        const current = await transaction.get(ref)
        if(current.exists && current.data().ownerId !== userId) throw new Error('You cannot edit this resource.')
        if(current.exists && ['hidden', 'deleted'].includes(current.data().status)) throw new Error('This resource cannot be republished.')
        const account = await readAccount(transaction, userId)
        const firstPublish = data.status === 'published' && !current.data()?.everPublished
        const publishDayKey = resolveDayKey(account)
        const publishQuestSnap = await transaction.get(questDayRef(userId, publishDayKey))
        const publishQuests = firstPublish
            ? applyQuestProgress(transaction, { userId, dayKey: publishDayKey, daySnap: publishQuestSnap, metric: 'resource_published' })
            : { reward: { xp: 0, lumen: 0, crates: 0 }, completed: [], quests: [] }
        transaction.set(ref, {
            ...pack(data), ownerId: userId, heartsCount: current.data()?.heartsCount || 0,
            everPublished: Boolean(current.data()?.everPublished || firstPublish),
            reportsCount: current.data()?.reportsCount || 0, createdAt: current.data()?.createdAt || new Date(), updatedAt: new Date(),
        })
        writeAccount(transaction, { ...account, progress: { ...account.progress, publishedResources: (Number(account.progress.publishedResources) || 0) + (firstPublish ? 1 : 0) } }, { ...publishQuests.reward, counter: firstPublish && data.type === 'lesson' ? 'publishedLessons' : null })
        return { id: ref.id, ...data, questsCompleted: publishQuests.completed, quests: publishQuests.quests }
    })
}

const removeResource = async (userId, id) => {
    const ref = db.collection('resources').doc(id)
    const doc = await ref.get()
    if(!doc.exists || doc.data().ownerId !== userId) throw new Error('Resource not found.')
    await ref.update({ status: 'deleted', updatedAt: new Date() })
    return { ok: true }
}

const toggleHeart = async (userId, id) => db.runTransaction(async (transaction) => {
    const ref = db.collection('resources').doc(id)
    const heartRef = ref.collection('hearts').doc(userId)
    const [resource, heart] = await Promise.all([transaction.get(ref), transaction.get(heartRef)])
    if(!resource.exists || resource.data().status !== 'published') throw new Error('Resource unavailable.')
    const owner = await readAccount(transaction, resource.data().ownerId)
    const giver = resource.data().ownerId === userId ? owner : await readAccount(transaction, userId)
    const heartDayKey = resolveDayKey(giver)
    const heartQuestSnap = await transaction.get(questDayRef(userId, heartDayKey))
    const active = !heart.exists
    if(active) transaction.create(heartRef, { userId, createdAt: new Date() })
    else transaction.delete(heartRef)
    const count = Math.max(0, (Number(resource.data().heartsCount) || 0) + (active ? 1 : -1))
    transaction.update(ref, { heartsCount: count })
    writeAccount(transaction, { ...owner, progress: { ...owner.progress, heartsReceived: Math.max(0, (Number(owner.progress.heartsReceived) || 0) + (active ? 1 : -1)) } })

    // Only adding a heart advances the quest; un-hearting never takes it back.
    const heartQuests = active && resource.data().ownerId !== userId
        ? applyQuestProgress(transaction, { userId, dayKey: heartDayKey, daySnap: heartQuestSnap, metric: 'heart_given' })
        : { reward: { xp: 0, lumen: 0, crates: 0 }, completed: [], quests: [] }

    if(heartQuests.reward.xp || heartQuests.reward.lumen || heartQuests.reward.crates) {
        writeAccount(transaction, giver, heartQuests.reward)
    }

    return { active, count, questsCompleted: heartQuests.completed, quests: heartQuests.quests }
})

const reportResource = async (userId, id, reason) => db.runTransaction(async (transaction) => {
    const ref = db.collection('resources').doc(id)
    const reportRef = ref.collection('reports').doc(userId)
    const [resource, existing] = await Promise.all([transaction.get(ref), transaction.get(reportRef)])
    if(!resource.exists || resource.data().status !== 'published') throw new Error('Resource unavailable.')
    if(existing.exists) return { reported: true }
    transaction.create(reportRef, { userId, reason: cleanText(reason, 500), createdAt: new Date() })
    const count = (Number(resource.data().reportsCount) || 0) + 1
    transaction.update(ref, { reportsCount: count, ...(count >= 3 ? { status: 'hidden' } : {}) })
    return { reported: true }
})

const validateCollegePost = (input) => {
    const college = cleanText(input?.college, 120)
    const year = Number(input?.year)
    const outcome = String(input?.outcome || '')
    if(!college || !Number.isInteger(year) || year < 2000 || year > new Date().getFullYear() + 2 || !COLLEGE_OUTCOMES.has(outcome)) throw new Error('Enter a college, year, and valid outcome.')
    const numberOrNull = (value, min, max) => value === '' || value == null ? null : (Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max ? Number(value) : null)
    if(['sat', 'act', 'gpa'].some((key) => input[key] !== '' && input[key] != null && numberOrNull(input[key], key === 'sat' ? 400 : key === 'act' ? 1 : 0, key === 'sat' ? 1600 : key === 'act' ? 36 : 5) === null)) throw new Error('Enter valid optional statistics.')
    return {
        college, collegeKey: college.toLowerCase().replace(/\s+/g, ' '), year, outcome,
        sat: numberOrNull(input.sat, 400, 1600), act: numberOrNull(input.act, 1, 36),
        gpa: numberOrNull(input.gpa, 0, 5), note: cleanText(input.note, 1200),
        attributed: Boolean(input.attributed), status: 'published',
    }
}

const publicCollegePost = (doc, viewerId = null) => {
    const data = doc.data()
    if(data.status !== 'published') return null
    const { ownerId, ...publicData } = data
    return { id: doc.id, ...publicData, isMine: ownerId === viewerId, ...(data.attributed ? { ownerId } : {}) }
}

const listCollegePosts = async (viewerId) => {
    const snap = await db.collection('collegePosts').orderBy('createdAt', 'desc').limit(200).get()
    const posts = snap.docs.map((doc) => publicCollegePost(doc, viewerId)).filter(Boolean)
    const namedIds = [...new Set(posts.filter((post) => post.attributed && post.ownerId).map((post) => post.ownerId))]
    const users = await Promise.all(namedIds.map((id) => db.collection('users').doc(id).get()))
    const names = new Map(users.map((user) => [user.id, user.data()?.profile?.displayName || 'Student']))
    return posts.map((post) => ({ ...post, ...(post.attributed ? { displayName: names.get(post.ownerId) || 'Student' } : {}) })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
}

const saveCollegePost = async (userId, input) => {
    const data = validateCollegePost(input)
    const ref = input.id ? db.collection('collegePosts').doc(String(input.id)) : db.collection('collegePosts').doc()
    const existing = await ref.get()
    if(existing.exists && existing.data().ownerId !== userId) throw new Error('You cannot edit this post.')
    if(existing.exists && ['hidden', 'deleted'].includes(existing.data().status)) throw new Error('This post cannot be republished.')
    await ref.set({ ...data, ownerId: userId, reportsCount: existing.data()?.reportsCount || 0, createdAt: existing.data()?.createdAt || new Date(), updatedAt: new Date() })
    return { id: ref.id, ...data }
}

const removeCollegePost = async (userId, id) => {
    const ref = db.collection('collegePosts').doc(id)
    const doc = await ref.get()
    if(!doc.exists || doc.data().ownerId !== userId) throw new Error('Post not found.')
    await ref.update({ status: 'deleted' })
    return { ok: true }
}

const reportCollegePost = async (userId, id, reason) => db.runTransaction(async (transaction) => {
    const ref = db.collection('collegePosts').doc(id)
    const reportRef = ref.collection('reports').doc(userId)
    const [post, existing] = await Promise.all([transaction.get(ref), transaction.get(reportRef)])
    if(!post.exists || post.data().status !== 'published') throw new Error('Post unavailable.')
    if(existing.exists) return { reported: true }
    transaction.create(reportRef, { userId, reason: cleanText(reason, 500), createdAt: new Date() })
    const count = (Number(post.data().reportsCount) || 0) + 1
    transaction.update(ref, { reportsCount: count, ...(count >= 3 ? { status: 'hidden' } : {}) })
    return { reported: true }
})

export {
    getResource, listCollegePosts, listResources, publicCollegePost, removeCollegePost, removeResource,
    reportCollegePost, reportResource, saveCollegePost, saveResource, toggleHeart, validateBlock,
    validateCollegePost, validateResource, validExternalUrl,
}
