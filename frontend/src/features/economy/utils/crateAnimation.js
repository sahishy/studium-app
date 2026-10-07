// Leaving the opening flow always overrides its last (possibly clamped) clip.
export const getCrateAnimationName = (interactive, motion) => !interactive
    ? 'Idle'
    : motion?.clip ?? 'WaitingIdle'
