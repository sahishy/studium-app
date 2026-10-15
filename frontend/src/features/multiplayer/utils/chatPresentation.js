const getChatSenderPresentation = (message, viewerUserId) => {
    const isSystemMessage = Boolean(message?.system || message?.senderName === 'System')
    const isSpectatorMessage = message?.senderRole === 'spectator'
    const senderName = message?.userId === viewerUserId ? 'You' : (message?.senderName ?? 'Opponent')

    return {
        isSystemMessage,
        isSpectatorMessage,
        senderLabel: isSpectatorMessage ? `(SPECTATOR) ${senderName}` : senderName,
    }
}

export { getChatSenderPresentation }
