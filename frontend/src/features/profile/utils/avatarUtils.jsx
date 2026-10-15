import face0 from '../../../assets/models/textures/face0.png'
import face1 from '../../../assets/models/textures/face1.png'
import face2 from '../../../assets/models/textures/face2.png'
import face3 from '../../../assets/models/textures/face3.png'
import face4 from '../../../assets/models/textures/face4.png'
import face5 from '../../../assets/models/textures/face5.png'
import face6 from '../../../assets/models/textures/face6.png'
import face7 from '../../../assets/models/textures/face7.png'
import face8 from '../../../assets/models/textures/face8.png'
import face9 from '../../../assets/models/textures/face9.png'
import face10 from '../../../assets/models/textures/face10.png'
import face11 from '../../../assets/models/textures/face11.png'
import face12 from '../../../assets/models/textures/face12.png'
import face13 from '../../../assets/models/textures/face13.png'

const AVATAR_COLORS = [
    '#fcd34d', // yellow
    '#22c55e', // green
    '#60a5fa', // blue
    '#f87171' // red
]

const AVATAR_FACES = [face0, face1, face2, face3, face4, face5, face6, face7, face8, face9, face10, face11, face12, face13]

// The three faces every student starts with; the rest come from crates.
const STARTER_FACES = [0, 1, 2]

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
    STARTER_FACES,
    getRandomAvatarColor,
}
