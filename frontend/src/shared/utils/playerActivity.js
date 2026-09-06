const MODE_NAMES = {
    'sat-classic': 'Classic',
    'sat-timber': 'Timber',
    'sat-puncture': 'Puncture',
    'sat-flutter': 'Flutter',
    blitz: 'Blitz',
}

const getPlayerActivity = (profile) => {
    if(profile?.status !== 'active') return { label: 'Offline', colorClass: 'text-neutral2', dotColorClass: 'bg-neutral2', state: 'offline' }

    const activity = profile?.activity
    const modeName = MODE_NAMES[activity?.modeId] ?? activity?.modeId ?? null
    if(activity?.state === 'in_game') {
        return { label: modeName ? `In game · ${modeName}` : 'In game', colorClass: 'text-emerald-400', dotColorClass: 'bg-emerald-400', state: 'in_game' }
    }
    if(activity?.state === 'in_party') {
        const playerCount = Number(activity.partyPlayerCount)
        const details = [Number.isInteger(playerCount) && playerCount > 0 ? `${playerCount} players` : null, modeName].filter(Boolean)
        return { label: details.length ? `In party · ${details.join(' · ')}` : 'In party', colorClass: 'text-violet-400', dotColorClass: 'bg-violet-400', state: 'in_party' }
    }
    return { label: 'Online', colorClass: 'text-sky-400', dotColorClass: 'bg-sky-400', state: 'online' }
}

export { getPlayerActivity }
