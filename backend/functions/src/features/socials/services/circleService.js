import { db } from '../../../lib/firebaseAdmin.js'
import { getCompetitiveCircle } from '../utils/circleUtils.js'

const updateCircleElo = async ({ transaction, userId, eloDelta = 0, now = new Date(), competitiveCircleDoc = null }) => {

    const resolvedDelta = Number(eloDelta) || 0
    if(!transaction || !userId || !resolvedDelta) {
        return
    }

    let competitiveCircle = competitiveCircleDoc
    const shouldResolveCompetitiveCircleFromReads = typeof competitiveCircleDoc === 'undefined'

    if(shouldResolveCompetitiveCircleFromReads) {
        const circlesQuery = db.collection('circles').where('type', '==', 'competitive')
        const circlesSnap = await transaction.get(circlesQuery)
        const circles = circlesSnap.docs

        if(!circles.length) {
            return
        }

        const membershipChecks = await Promise.all(circles.map(async (circleDoc) => {
            const memberRef = circleDoc.ref.collection('members').doc(userId)
            const memberSnap = await transaction.get(memberRef)
            return memberSnap.exists ? circleDoc.id : null
        }))

        const memberCircleIds = membershipChecks.filter(Boolean)
        competitiveCircle = getCompetitiveCircle({ circles, memberCircleIds })
    }

    if(!competitiveCircle) {
        return
    }

    const circleData = competitiveCircle.data() ?? {}
    const currentTotalElo = Number(circleData.totalElo) || 0
    const nextTotalElo = Math.max(0, currentTotalElo + resolvedDelta)

    transaction.set(competitiveCircle.ref, {
        totalElo: nextTotalElo,
        updatedAt: now,
    }, { merge: true })

}

export {
    updateCircleElo,
}
