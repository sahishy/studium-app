import { useEffect, useRef } from 'react'

const PhaserGameHost = ({ createGame, className = '', onGameReady = null, onGameDestroyed = null }) => {

    const containerRef = useRef(null)
    const gameRef = useRef(null)

    useEffect(() => {
        if(!containerRef.current) {
            return () => {}
        }

        gameRef.current = createGame(containerRef.current)
        onGameReady?.(gameRef.current)

        return () => {
            if(gameRef.current) {
                onGameDestroyed?.(gameRef.current)
                gameRef.current.destroy(true)
                gameRef.current = null
            }
        }
    }, [createGame, onGameReady, onGameDestroyed])

    return (
        <div
            ref={containerRef}
            className={className}
        />
    )
}

export default PhaserGameHost