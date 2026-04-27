const getXpToNextLevel = ( level ) => {
    return Math.pow(2, level) * 100
}

export {
    getXpToNextLevel
}