import { Link, useLocation } from 'react-router-dom'
import { FaThumbtack } from 'react-icons/fa6'
import { useCircles } from '../contexts/CirclesContext'
export default function SidebarCircles({expanded,pins,toggle,onNavigate,disabled}) {
    const circles=useCircles(), location=useLocation()
    const shown=circles.filter(c=>pins.includes(c.uid) || expanded)
    if(!shown.length) return null
    return <div className="ml-5 flex flex-col gap-1">{shown.map(circle=>{
        const pinned=pins.includes(circle.uid),path=`/socials/circle/${circle.uid}`
        const active=location.pathname===path || location.pathname.startsWith(`${path}/`)
        return <div key={circle.uid} className={`group flex items-center rounded-xl transition-all ${disabled?'text-neutral1 cursor-not-allowed opacity-40':active?'text-neutral0 bg-neutral3':'text-neutral1 hover:bg-neutral4'}`}>
        <Link aria-disabled={disabled} aria-current={active?'page':undefined} onClick={e=>{if(disabled)e.preventDefault();else onNavigate?.()}} to={`${path}/activity`} className="min-w-0 flex-1 py-2 px-3 text-sm truncate">{circle.profile.title}</Link>
        <button disabled={disabled} aria-label={`${pinned?'Unpin':'Pin'} ${circle.profile.title}`} aria-pressed={pinned} onClick={()=>toggle(circle.uid)} className={`p-2 text-xs focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 ${pinned?'text-sat0':'text-neutral1 lg:opacity-0'}`}><FaThumbtack /></button>
    </div>})}</div>
}
