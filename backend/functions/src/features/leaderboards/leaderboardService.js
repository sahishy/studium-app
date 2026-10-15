import { getModeElo } from '../realtime/ratingState.js'

const RANKED_MODE_IDS = ['sat-classic', 'sat-timber', 'sat-puncture', 'sat-flutter']

const computeTotalElo = (play = {}) => {
    return RANKED_MODE_IDS.reduce((total, modeId) => total + getModeElo(play?.[modeId]), 0)
}

export { RANKED_MODE_IDS, computeTotalElo }
