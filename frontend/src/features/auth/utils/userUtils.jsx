import usernames from '../../../data/usernames.json'

const DISPLAY_NAME_MIN = 3
const DISPLAY_NAME_MAX = 23
const DISPLAY_NAME_REGEX = /^[A-Za-z0-9]+$/
const FLAIR_OPTIONS = [
    { value: null, label: 'None' },
    { value: 'score:sat', label: 'SAT Score' },
    { value: 'score:act', label: 'ACT Score' },
    { value: 'gpa:unweighted', label: 'Unweighted GPA' },
    { value: 'gpa:weighted', label: 'Weighted GPA' },
    { value: 'circle', label: 'Circle Flair' },
]

const getRandomArrayItem = (array = []) => {
    if(!array.length) return ''
    const randomIndex = Math.floor(Math.random() * array.length)
    return array[randomIndex]
}

const generateRandomDisplayName = () => {
    const adjective = getRandomArrayItem(usernames.adjectives)
    const noun = getRandomArrayItem(usernames.nouns)
    const digits = Math.floor(Math.random() * 100000).toString().padStart(5, '0')

    return `${adjective}${noun}${digits}`
}

const isDisplayNameFormatValid = (displayName = '') => {
    const length = displayName.length
    return (
        length >= DISPLAY_NAME_MIN &&
        length <= DISPLAY_NAME_MAX &&
        DISPLAY_NAME_REGEX.test(displayName)
    )
}

export {
    DISPLAY_NAME_MIN,
    DISPLAY_NAME_MAX,
    DISPLAY_NAME_REGEX,
    FLAIR_OPTIONS,
    generateRandomDisplayName,
    isDisplayNameFormatValid,
}