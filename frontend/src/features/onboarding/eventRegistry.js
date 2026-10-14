// Add a renderer here when registering a new server event type. The queue always
// presents the first pending event and never acknowledges later events implicitly.
const renderers = new Map()
export const registerOnlineEventRenderer = (type, renderer) => {
    renderers.set(type, renderer)
    return () => renderers.delete(type)
}
export const getOnlineEventRenderer = type => renderers.get(type)
