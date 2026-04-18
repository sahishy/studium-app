const MULTIPLAYER_MODE_IDS = {
    SAT_CLASSIC: 'sat-classic',
}

const isSupportedMultiplayerMode = (modeId) => (
    Object.values(MULTIPLAYER_MODE_IDS).includes(modeId)
)

export {
    MULTIPLAYER_MODE_IDS,
    isSupportedMultiplayerMode,
}
