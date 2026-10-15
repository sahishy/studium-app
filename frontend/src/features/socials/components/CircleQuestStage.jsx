import { useLayoutEffect, useRef, useState } from 'react'
import AvatarModel from '../../../shared/components/avatar/AvatarModel'
import GrandQuestOrb from './GrandQuestOrb'

const STAGE_WIDTH = 512
const STAGE_HEIGHT = 480
const MEMBER_SPOTS = [
    { left: '9%', bottom: '2%', layer: 20, rotation: Math.PI / 8 },
    { left: '91%', bottom: '2%', layer: 20, rotation: -Math.PI / 8 },
    { left: '50%', bottom: '0%', layer: 20, rotation: 0 },
    { left: '16%', bottom: '7%', layer: 5, rotation: Math.PI / 6 },
    { left: '84%', bottom: '7%', layer: 5, rotation: -Math.PI / 6 },
]

const CircleQuestStage = ({ count, target, members = [], canClaim = false, claiming = false, onClaim }) => {
    const viewportRef = useRef(null)
    const [scale, setScale] = useState(0)

    useLayoutEffect(() => {
        const viewport = viewportRef.current
        const measure = () => setScale(Math.max(0, Math.min(1, viewport.clientWidth / STAGE_WIDTH, viewport.clientHeight / STAGE_HEIGHT)))
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(viewport)
        return () => observer.disconnect()
    }, [])

    return <div ref={viewportRef} className="relative isolate flex-1 min-h-0 w-full">
        <div className="absolute left-1/2 top-0" style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transformOrigin: 'top center', transform: `translateX(-50%) scale(${scale})` }}>
            <div className="absolute inset-x-0 top-0 z-10 flex justify-center">
                <GrandQuestOrb count={count} target={target} canClaim={canClaim} claiming={claiming} onClaim={onClaim} />
            </div>
            {members.slice(0, 5).map((member, index) => {
                const spot = MEMBER_SPOTS[members.length === 1 ? 2 : index]
                return <div key={member.uid} role="img" aria-label={`${member.profile?.displayName || 'Circle member'} standing by the Grand Quest`}
                    className="absolute w-52 h-56 -translate-x-1/2 pointer-events-none"
                    style={{ left: spot.left, bottom: spot.bottom, zIndex: spot.layer }}>
                    <div aria-hidden="true" className="absolute bottom-[14%] left-1/2 -translate-x-1/2 w-[42%] h-[8%] rounded-[50%] bg-neutral5" />
                    <AvatarModel profile={member} animation="Idle" interactive={false} cameraPosition={[0, 0, 9]}
                        rotation={[0, spot.rotation, 0]} className="relative h-full! w-full!" />
                </div>
            })}
        </div>
    </div>
}

export default CircleQuestStage
