import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../src/shared/contexts/ToastContext'
import TimberGame from '../src/features/multiplayer/games/timber/TimberGame'
import PunctureGame from '../src/features/multiplayer/games/puncture/PunctureGame'
import FlutterGame from '../src/features/multiplayer/games/flutter/FlutterGame'
import PunctureScene from '../src/features/multiplayer/games/puncture/components/PunctureScene'
import { configureRealtimeProfile, preconnectGame, subscribeToGameSnapshot, getGameLatencyMetrics, getGameServerNow, sendGameMessage } from '../src/features/multiplayer/services/realtimeSocketService'
import '../src/index.css'
const params = new URLSearchParams(location.search)
const roomId = params.get('room'), userId = params.get('user'), mode = params.get('mode')
const bridge = window.__netcodeTest = { snapshot: null, errors: [], metrics: () => getGameLatencyMetrics(roomId), send: (type, payload) => sendGameMessage(roomId, type, payload), now: () => getGameServerNow(roomId) }
window.addEventListener('error', (event) => bridge.errors.push(event.message))
if(roomId) {
    configureRealtimeProfile({ uid: userId, profile: { displayName: 'Test Player' } })
    preconnectGame(roomId, params.get('admission'))
    subscribeToGameSnapshot(roomId, (snapshot) => { bridge.snapshot = snapshot })
}
const SceneHarness = () => {
    const [shots, setShots] = useState([])
    bridge.fire = (index, shotAt = Date.now()) => setShots((current) => [...current, { clientActionId: `test-${index}`, shotAt, impactAt: shotAt + 75, hit: false, attachedAngle: index * 20, targetAngle: index * 20 }])
    bridge.correct = (index) => setShots((current) => current.map((shot) => shot.clientActionId === `test-${index}` ? { ...shot, attachedAngle: 12, targetAngle: 12 } : shot))
    return <div style={{ width: 500, height: 500, position: 'relative' }}><PunctureScene roundIndex={1} roundStartedAt={Date.now() - 1000} rotationTurnsPerSecond={.5} shotEvents={shots} attachedPinAngles={shots.map((shot) => shot.attachedAngle)} pinsRemaining={20 - shots.length} /></div>
}
const Game = mode === 'sat-flutter' ? FlutterGame : mode === 'sat-puncture' ? PunctureGame : TimberGame
createRoot(document.getElementById('root')).render(<MemoryRouter><ToastProvider>{mode === 'scene' ? <SceneHarness /> : <Game roomId={roomId} userId={userId} />}</ToastProvider></MemoryRouter>)
