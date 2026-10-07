import { Router } from 'express'
import { auth, db } from '../../lib/firebaseAdmin.js'
import { claimLevelReward, equipAvatar, getEconomySnapshot, openCrate, readAccount, tipResource, writeAccount } from '../economy/economyService.js'
import { reconcileTaskTree, setTaskStatus } from '../tasks/taskStatusService.js'
import { getQuestBoard } from '../quests/questService.js'
import {
    getResource, listCollegePosts, listResources, removeCollegePost, removeResource,
    reportCollegePost, reportResource, saveCollegePost, saveResource, toggleHeart,
} from '../resources/contentService.js'

const router = Router()
const route = (handler) => async (req, res) => {
    try { res.json(await handler(req)) }
    catch(error) { res.status(error.message?.includes('cannot') || error.message?.includes('Unauthorized') ? 403 : 400).json({ error: error.message || 'Request failed.' }) }
}

router.use(async (req, res, next) => {
    try {
        const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
        if(!token) throw new Error('Unauthorized.')
        req.identity = await auth.verifyIdToken(token)
        next()
    } catch { res.status(401).json({ error: 'Unauthorized.' }) }
})

router.get('/economy', route((req) => getEconomySnapshot(req.identity.uid)))
router.get('/quests', route((req) => getQuestBoard(req.identity.uid, String(req.query.timeZone || 'UTC'))))
router.post('/economy/crates/open', route((req) => openCrate(req.identity.uid, req.body.operationId)))
router.post('/economy/levels/claim', route((req) => claimLevelReward(req.identity.uid, req.body.level)))
router.post('/economy/avatar/equip', route((req) => equipAvatar(req.identity.uid, req.body.color, req.body.face)))
router.post('/economy/tips', route((req) => tipResource(req.identity.uid, req.body.resourceId, Number(req.body.amount), req.body.operationId)))
router.post('/tasks/:id/status', route((req) => setTaskStatus({ userId: req.identity.uid, taskId: req.params.id, status: req.body.status, timeZone: req.body.timeZone })))
router.post('/tasks/:id/reconcile', route((req) => reconcileTaskTree({ userId: req.identity.uid, taskId: req.params.id })))

router.get('/resources', route((req) => listResources(req.identity.uid, req.query.mine === 'true')))
router.get('/resources/:id', route((req) => getResource(req.params.id, req.identity.uid)))
router.post('/resources', route((req) => saveResource(req.identity.uid, req.body)))
router.delete('/resources/:id', route((req) => removeResource(req.identity.uid, req.params.id)))
router.post('/resources/:id/heart', route((req) => toggleHeart(req.identity.uid, req.params.id)))
router.post('/resources/:id/report', route((req) => reportResource(req.identity.uid, req.params.id, req.body.reason)))

router.get('/college-posts', route((req) => listCollegePosts(req.identity.uid)))
router.post('/college-posts', route((req) => saveCollegePost(req.identity.uid, req.body)))
router.delete('/college-posts/:id', route((req) => removeCollegePost(req.identity.uid, req.params.id)))
router.post('/college-posts/:id/report', route((req) => reportCollegePost(req.identity.uid, req.params.id, req.body.reason)))

router.post('/moderation/resources/:id/hide', route(async (req) => {
    if(req.identity.admin !== true) throw new Error('Unauthorized.')
    await db.collection('resources').doc(req.params.id).update({ status: 'hidden', updatedAt: new Date() })
    return { ok: true }
}))
router.post('/moderation/college-posts/:id/hide', route(async (req) => {
    if(req.identity.admin !== true) throw new Error('Unauthorized.')
    await db.collection('collegePosts').doc(req.params.id).update({ status: 'hidden', updatedAt: new Date() })
    return { ok: true }
}))

// Local-only helper for exercising reward animations against the emulators.
// It is never registered against deployed functions.
if(process.env.FUNCTIONS_EMULATOR === 'true') {
    router.post('/dev/grant', route(async (req) => {
        const xp = Math.max(0, Math.min(10000, Number(req.body.xp) || 0))
        const lumen = Math.max(0, Math.min(10000, Number(req.body.lumen) || 0))
        return db.runTransaction(async (transaction) => {
            const account = await readAccount(transaction, req.identity.uid)
            return writeAccount(transaction, account, { xp, lumen })
        })
    }))

    // Clears level, XP, Lumen and every claimed reward so the progress roadmap
    // can be exercised from scratch without leaving half-claimed state behind.
    router.post('/dev/reset', route(async (req) => db.runTransaction(async (transaction) => {
        const userRef = db.collection('users').doc(req.identity.uid)
        const walletRef = db.collection('wallets').doc(req.identity.uid)
        const userSnap = await transaction.get(userRef)
        const progress = userSnap.data()?.progress ?? {}
        transaction.set(userRef, {
            progress: { ...progress, level: 1, xp: 0, curveVersion: 3 },
        }, { merge: true })
        transaction.set(walletRef, {
            balance: 0,
            crateTokens: 0,
            claimedLevels: [],
            inventory: [],
        }, { merge: true })
        return { ok: true }
    })))
}

export default router
