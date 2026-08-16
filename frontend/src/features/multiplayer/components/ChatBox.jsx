import { useEffect, useMemo, useRef, useState } from 'react'
import { sendRoomChatMessage, subscribeToRoomChat } from '../services/chatService'
import { formatTimeFromFirestoreLike, toMillisFromFirestoreLike } from '../../../shared/utils/formatters'
import { cleanText } from '../../../shared/services/censorService'

const ChatBox = ({ roomId, userId, senderName, messages = null, onSendMessage = null, className = '' }) => {

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

    }, [mergedMessages])

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

    return (
        <div className={`absolute z-[200] left-6 bottom-6 w-72 h-44 flex flex-col pointer-events-none ${className}`}>
            <div
                ref={chatMessagesContainerRef}
                className='flex-1 min-h-0 overflow-y-auto flex flex-col justify-end text-[10px]'
            >
                {mergedMessages.map((message) => {

                    const isSystemMessage = message.system || message.senderName === 'System';
                    const isOwnMessage = message.userId === userId
                    const senderLabel = isOwnMessage ? 'You' : (message.senderName ?? 'Opponent')
                    const timestamp = formatTimeFromFirestoreLike(message.createdAt)

                    return (
                        <div
                            key={message.uid}
                            className={`p-1 whitespace-pre-wrap break-words bg-neutral0/[0.05] [backdrop-filter:blur(14px)_saturate(125%)] [-webkit-backdrop-filter:blur(14px)_saturate(125%)] flex justify-between gap-2
                                ${message.pending && 'text-neutral1'}
                                ${isSystemMessage && 'text-neutral1'}
                            `}
                        >
                            <div>
                                {!isSystemMessage && <span className='font-semibold'>{senderLabel}:</span>}
                                {' '}{message.text}
                            </div>
                            {timestamp ? <span className='text-neutral1 text-[8px] shrink-0'>{timestamp}</span> : null}
                        </div>
                    )
                })}
            </div>

            <div>
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
                    placeholder='Type a message...'
                    className='w-full bg-neutral0/[0.05] [backdrop-filter:blur(14px)_saturate(125%)] [-webkit-backdrop-filter:blur(14px)_saturate(125%)] p-1 text-[10px] outline-none rounded-b-md pointer-events-auto'
                />
            </div>
        </div>
    )
    
}

export default ChatBox
