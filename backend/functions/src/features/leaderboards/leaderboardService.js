const RANKED_MODE_IDS = ['sat-classic', 'sat-timber', 'sat-puncture', 'sat-flutter']

const computeTotalElo = (play = {}) => {
    return RANKED_MODE_IDS.reduce((total, modeId) => total + (Number(play?.[modeId]?.elo) || 0), 0)
}

export { RANKED_MODE_IDS, computeTotalElo }
