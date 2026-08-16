import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMultiplayer } from '../features/multiplayer/contexts/MultiplayerContext'

const PartyJoinRedirect = () => {
    const { partyId } = useParams()
    const navigate = useNavigate()
    const { session, joinParty } = useMultiplayer()
    const attemptedRef = useRef(false)

    useEffect(() => {
        if(!partyId || !session || attemptedRef.current) return
        attemptedRef.current = true
        const join = session.partyId ? Promise.resolve() : joinParty({ partyId })
        void join.finally(() => navigate('/play', { replace: true }))
    }, [partyId, session, joinParty, navigate])

    return null
}

export default PartyJoinRedirect
