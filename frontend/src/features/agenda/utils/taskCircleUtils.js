const getCircleTitle = (circle, fallback = '') => circle?.profile?.title || circle?.title || circle?.name || fallback

const buildCircleOptions = (circles = [], { truncate = false } = {}) => [
    { uid: null, label: 'None', icon: null },
    ...circles.map((circle) => {
        const title = getCircleTitle(circle, 'Unnamed circle')
        return { uid: circle.uid, label: truncate && title.length > 25 ? `${title.substring(0, 25)}...` : title, icon: null }
    }),
]

export { getCircleTitle, buildCircleOptions }
