import Window from '../../../shared/components/windows/Window'
import Button from '../../../shared/components/ui/Button'
import { useEffect, useMemo, useRef, useState } from 'react'
import { sendRoomChatMessage, subscribeToRoomChat } from '../services/chatService'
import { formatTimeFromFirestoreLike, toMillisFromFirestoreLike } from '../../../shared/utils/formatters'
import { cleanText } from '../../../shared/services/censorService'
import { getChatSenderPresentation } from '../utils/chatPresentation'

const ChatBox = ({ roomId, userId, senderName, isSpectator = false, messages = null, onSendMessage = null, className = '', windowed = false, isOpen = true, onClose = null }) => {

    const [chatMessages, setChatMessages] = useState([])
    const [pendingMessages, setPendingMessages] = useState([])
    const [chatInput, setChatInput] = useState('')
    const chatMessagesContainerRef = useRef(null)
    const chatInputRef = useRef(null)

    useEffect(() => {

        if(Array.isArray(messages)) {
            setChatMessages(messages)
            return () => {}
        }

        if(!roomId) {
            setChatMessages([])
            setPendingMessages([])
            return () => {}
        }

        const unsubscribe = subscribeToRoomChat(roomId, setChatMessages)
        return () => unsubscribe()

    }, [roomId, messages])

    useEffect(() => {

        if(!chatMessages.length) {
            return
        }

        setPendingMessages((previous) => previous.filter((pendingMessage) => (
            !chatMessages.some((message) => (
                message.clientMessageId
                && message.clientMessageId === pendingMessage.clientMessageId
                && message.userId === pendingMessage.userId
            ))
        )))

    }, [chatMessages])

    const mergedMessages = useMemo(() => (

        [...chatMessages, ...pendingMessages].sort((a, b) => (
            toMillisFromFirestoreLike(a.createdAt) - toMillisFromFirestoreLike(b.createdAt)
        ))

    ), [chatMessages, pendingMessages])

    useEffect(() => {

        if(!chatMessagesContainerRef.current) {
            return
        }
        chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight

    }, [mergedMessages, windowed, isOpen])

    const handleSendMessage = async () => {

        const trimmedInput = chatInput.trim()
        if(!trimmedInput || (!roomId && !onSendMessage) || !userId) {
            return
        }

        const clientMessageId = `${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const optimisticMessage = {
            uid: `pending_${clientMessageId}`,
            clientMessageId,
            userId,
            senderName: senderName ?? null,
            text: trimmedInput,
            createdAt: new Date(),
            pending: true,
            ...(isSpectator ? { senderRole: 'spectator' } : {}),
        }

        setPendingMessages((previous) => [...previous, optimisticMessage])
        setChatInput('')
        chatInputRef.current?.focus()

        try {
            const outgoingMessage = { text: cleanText(trimmedInput), clientMessageId }
            if(onSendMessage) await onSendMessage(outgoingMessage)
            else await sendRoomChatMessage({ roomId, ...outgoingMessage })
        } catch {
            setPendingMessages((previous) => previous.filter((message) => message.clientMessageId !== clientMessageId))
        }
    }

    const content = (
        <div className={`${windowed ? 'flex h-full min-h-0 flex-col gap-3' : 'absolute z-[200] left-6 bottom-6 w-72 h-44 flex flex-col pointer-events-none'} ${className}`}>
            <div
                ref={chatMessagesContainerRef}
                className={`flex-1 min-h-0 overflow-y-auto flex flex-col ${windowed ? 'gap-1 text-sm overscroll-contain' : 'justify-end text-[10px]'}`}
                role={windowed ? 'log' : undefined}
                aria-label={windowed ? 'Chat messages' : undefined}
            >
                {windowed && !mergedMessages.length ? <p className='text-sm text-neutral1'>No messages yet.</p> : null}
                {mergedMessages.map((message) => {

                    const { isSystemMessage, isSpectatorMessage, senderLabel } = getChatSenderPresentation(message, userId)
                    const timestamp = formatTimeFromFirestoreLike(message.createdAt)

                    return (
                        <div
                            key={message.uid}
                            className={`p-1 whitespace-pre-wrap break-words bg-neutral0/[0.05] [backdrop-filter:blur(14px)_saturate(125%)] [-webkit-backdrop-filter:blur(14px)_saturate(125%)] flex justify-between gap-2
                                ${message.pending && 'text-neutral1'}
                                ${isSystemMessage && 'text-neutral1'}
                                ${isSpectatorMessage && 'text-neutral1'}
                            `}
                        >
                            <div className='min-w-0'>
                                {!isSystemMessage && <span className='font-semibold'>{senderLabel}:</span>}
                                {' '}{message.text}
                            </div>
                            {timestamp ? <span className={`text-neutral1 shrink-0 ${windowed ? 'text-[10px]' : 'text-[8px]'}`}>{timestamp}</span> : null}
                        </div>
                    )
                })}
            </div>

            <form className={windowed ? 'flex shrink-0 items-center gap-2' : undefined} onSubmit={(event) => { event.preventDefault(); handleSendMessage() }}>
                <input
                    ref={chatInputRef}
                    type='text'
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={(event) => {
                        if(event.key === 'Enter') {
                            event.preventDefault()
                            handleSendMessage()
                        }
                    }}
                    aria-label='Chat message'
                    placeholder='Type a message...'
                    className={windowed ? 'min-w-0 flex-1 rounded-xl border border-neutral4 bg-neutral5 p-3 text-base outline-none focus:border-neutral2' : 'w-full bg-neutral0/[0.05] [backdrop-filter:blur(14px)_saturate(125%)] [-webkit-backdrop-filter:blur(14px)_saturate(125%)] p-1 text-[10px] outline-none rounded-b-md pointer-events-auto'}
                />
                {windowed ? <Button htmlType='submit' disabled={!chatInput.trim()}>Send</Button> : null}
            </form>
        </div>
    )

    return windowed ? (
        <Window isOpen={isOpen} onClose={onClose} title='Chat' initialSize={{ width: 360, height: 420 }} minWidth={240} minHeight={180} contentClassName='p-3!'>
            {content}
        </Window>
    ) : content
    
}

export default ChatBox
