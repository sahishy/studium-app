const getCompetitiveCircle = ({ circles = [], memberCircleIds = [] } = {}) => {

    if(!Array.isArray(circles) || !Array.isArray(memberCircleIds) || !memberCircleIds.length) {
        return null
    }

    const memberCircleIdSet = new Set(memberCircleIds.map((id) => String(id)))

    return circles.find((circleDoc) => {
        const circleId = String(circleDoc?.id ?? '')
        const circleType = String(circleDoc?.data?.()?.type ?? circleDoc?.type ?? '')
        return memberCircleIdSet.has(circleId) && circleType === 'competitive'
    }) ?? null

}

export {
    getCompetitiveCircle,
}
