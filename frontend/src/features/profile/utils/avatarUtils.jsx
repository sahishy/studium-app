import face0 from '../../../assets/models/textures/face0.png'
import face1 from '../../../assets/models/textures/face1.png'
import face2 from '../../../assets/models/textures/face2.png'

const AVATAR_COLORS = [
    '#fcd34d', // yellow
    '#22c55e', // green
    '#60a5fa', // blue
    '#f87171' // red
]

const AVATAR_FACES = [face0, face1, face2]

const getRandomArrayItem = (array = []) => {
    if(!array.length) return ''
    const randomIndex = Math.floor(Math.random() * array.length)
    return array[randomIndex]
}

const getRandomAvatarColor = () => {
    return getRandomArrayItem(AVATAR_COLORS) || AVATAR_COLORS[0]
}

export {
    AVATAR_COLORS,
    AVATAR_FACES,
    getRandomAvatarColor,
}
