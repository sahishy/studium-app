const websiteScreenshotUrl = (value) => {
    try {
        const url = new URL(value)
        if(!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
        // Local pages cannot be reached by the screenshot provider.
        const host = url.hostname.toLowerCase()
        if(!host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.includes(':')) return null
        const parts = host.split('.').map(Number)
        if(parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255)) {
            const [first, second] = parts
            if(first === 0 || first === 10 || first === 127 || first >= 224
                || first === 169 && second === 254 || first === 172 && second >= 16 && second <= 31
                || first === 192 && second === 168 || first === 100 && second >= 64 && second <= 127) return null
        }
        url.hash = ''
        return `https://image.thum.io/get/noanimate/width/600/crop/750/maxAge/24/${url.href}`
    } catch {
        return null
    }
}

export { websiteScreenshotUrl }
