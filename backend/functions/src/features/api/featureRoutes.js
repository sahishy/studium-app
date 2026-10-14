import { getOnlineEvents, acknowledgeEvent, startOnboarding, reserveArtifact, advanceOnboarding, answerPractice, completeOnboarding, openTutorialCrate, resetOnboardingForTesting } from '../onboarding/onboardingService.js'
import { listJoinedCircles, mutateMembership, setPrimaryCircle, editCircleIdentity, circleActivity, claimCircleGrandQuest } from '../socials/circleApi.js'
import { Router } from 'express'
import { auth, db } from '../../lib/firebaseAdmin.js'
import { deliverFeedback, validateFeedback } from '../feedback/feedbackService.js'
import { submitWithCooldown } from '../feedback/feedbackSubmission.js'
import { claimLevelReward, equipAvatar, equipTitle, getEconomySnapshot, openCrate, readAccount, tipResource, writeAccount } from '../economy/economyService.js'
import { reconcileTaskTree, setTaskStatus } from '../tasks/taskStatusService.js'
import { claimQuest, getQuestBoard, questById, recordQuestEvent, rerollQuest } from '../quests/questService.js'
import { claimStreakReward, getStreakBoard } from '../progress/streakService.js'
import { getMasteryBoard, getMatchMastery } from '../mastery/masteryService.js'
import {
    getResource, listCollegePosts, listResources, removeCollegePost, removeResource,
    reportCollegePost, reportResource, saveCollegePost, saveResource, toggleHeart,
} from '../resources/contentService.js'

const router = Router()
const route = (handler) => async (req, res) => {
    try { res.json(await handler(req)) }
    catch(error) { res.status(error.statusCode || (error.message?.includes('cannot') || error.message?.includes('Unauthorized') ? 403 : 400)).json({ error: error.message || 'Request failed.' }) }
}

router.use(async (req, res, next) => {
    try {
        const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
        if(!token) throw new Error('Unauthorized.')
        req.identity = await auth.verifyIdToken(token)
        next()
    } catch { res.status(401).json({ error: 'Unauthorized.' }) }
})

router.get('/events', route(req => getOnlineEvents(req.identity.uid)))
router.post('/events/acknowledge', route(req => acknowledgeEvent(req.identity.uid,req.body.eventId)))
router.post('/onboarding/start', route(req => startOnboarding(req.identity.uid,req.body.path)))
router.post('/onboarding/artifact', route(req => reserveArtifact(req.identity.uid,req.body)))
router.post('/onboarding/advance', route(req => advanceOnboarding(req.identity.uid,req.body)))
router.post('/onboarding/practice', route(req => answerPractice(req.identity.uid,req.body)))
router.post('/onboarding/crate', route(req => openTutorialCrate(req.identity.uid,req.body)))
router.post('/onboarding/complete', route(req => completeOnboarding(req.identity.uid,req.body)))

router.get('/circles', route(req => listJoinedCircles(req.identity.uid)))
router.post('/circles/membership', route(req => mutateMembership(req.identity.uid, req.body)))
router.post('/circles/primary', route(req => setPrimaryCircle(req.identity.uid, req.body.circleId)))
router.post('/circles/:id/identity', route(req => editCircleIdentity(req.identity.uid, req.params.id, req.body.profile)))
router.get('/circles/:id/activity', route(req => circleActivity(req.identity.uid, req.params.id, req.query.before)))
router.post('/circles/:id/grand-quest/claim', route(req => claimCircleGrandQuest(req.identity.uid, req.params.id, req.body.cycle)))

router.post('/feedback', route(async (req) => {
    const feedback = validateFeedback(req.body)
    const webhookUrl = process.env.DISCORD_FEEDBACK_WEBHOOK_URL
    if (!webhookUrl) throw new Error('Feedback is temporarily unavailable. Please try again later.')
    const uid = req.identity.uid
    const profile = await db.collection('users').doc(uid).get()
    return submitWithCooldown({
        db, uid,
        deliver: () => deliverFeedback({ webhookUrl, feedback, displayName: profile.data()?.profile?.displayName }),
    })
}))

router.get('/economy', route((req) => getEconomySnapshot(req.identity.uid)))
router.get('/quests', route((req) => getQuestBoard(req.identity.uid, String(req.query.timeZone || 'UTC'))))
router.post('/economy/crates/open', route((req) => openCrate(req.identity.uid, req.body.operationId)))
router.post('/economy/levels/claim', route((req) => claimLevelReward(req.identity.uid, req.body.level)))
router.post('/economy/avatar/equip', route((req) => equipAvatar(req.identity.uid, req.body.color, req.body.face)))
router.post('/economy/title/equip', route((req) => equipTitle(req.identity.uid, req.body.title)))
router.post('/quests/claim', route((req) => claimQuest(req.identity.uid, req.body.questId, req.body.instanceId, String(req.body.timeZone || 'UTC'))))

router.post('/quests/reroll', route((req) => rerollQuest(req.identity.uid, req.body.questId, String(req.body.timeZone || 'UTC'))))
router.get('/streak', route((req) => getStreakBoard(req.identity.uid, String(req.query.timeZone || 'UTC'))))
router.post('/streak/claim', route((req) => claimStreakReward(req.identity.uid, String(req.body.timeZone || 'UTC'))))
router.get('/mastery', route((req) => getMasteryBoard(req.identity.uid)))
router.get('/mastery/matches/:gameId', route((req) => getMatchMastery(req.identity.uid, req.params.gameId)))
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
    router.post('/dev/onboarding/reset', route(req => resetOnboardingForTesting(req.identity.uid)))
    router.post('/dev/grant', route(async (req) => {
        const xp = Math.max(0, Math.min(10000, Number(req.body.xp) || 0))
        const lumen = Math.max(0, Math.min(10000, Number(req.body.lumen) || 0))
        return db.runTransaction(async (transaction) => {
            const account = await readAccount(transaction, req.identity.uid)
            return writeAccount(transaction, account, { xp, lumen })
        })
    }))

    // Advances whichever quest currently fills a board slot by one, through the same path a real
    // match takes, so the toast and the claimable card can be exercised without playing anything.
    router.post('/dev/quests/progress', route(async (req) => {
        const slot = Math.max(0, Number(req.body.slot) || 0)
        const timeZone = String(req.body.timeZone || 'UTC')
        const board = await getQuestBoard(req.identity.uid, timeZone)
        const quest = (board.quests ?? [])[slot]
        const metric = quest ? questById(quest.id)?.metric : null

        if(!metric) throw new Error('No quest to advance in that slot.')

        return recordQuestEvent(req.identity.uid, metric, { amount: 1, timeZone })
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
