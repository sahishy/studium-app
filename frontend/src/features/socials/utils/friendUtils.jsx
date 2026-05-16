const FRIENDS_PAGE_SIZE = 9
const INCOMING_REQUESTS_PAGE_SIZE = 9

const normalizeFriendSearchInput = (value = '') => {
    return value.trim()
}

export {
    FRIENDS_PAGE_SIZE,
    INCOMING_REQUESTS_PAGE_SIZE,
    normalizeFriendSearchInput
}
