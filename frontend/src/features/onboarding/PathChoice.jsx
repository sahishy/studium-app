import { useState } from 'react'
import { FaBookOpen, FaGamepad, FaCompass } from 'react-icons/fa6'
import { PiStarFourFill } from 'react-icons/pi'
import Button from '../../shared/components/ui/Button'
import logoSmall from '../../assets/images/logo_sm.png'
import './onboarding.css'
const paths=[
    {id:'study',title:'Study',text:'Organize your tasks, add your classes, and explore student-made lessons.',xp:150,Icon:FaBookOpen,color:'#f59e0b'},
    {id:'play',title:'Gameplay',text:'Play a quick game, discover rewards, and customize your avatar.',xp:150,Icon:FaGamepad,color:'#0ea5e9'},
    {id:'both',title:'Both',text:'Get to know Studium through a game and some schoolwork organization.',xp:300,Icon:FaCompass,color:'#9ca3af'},
]
export default function PathChoice({dialogRef,busy,error,onStart,onSkip}){
    const [leaving,setLeaving]=useState(false)
    const [selectedPath,setSelectedPath]=useState('play')
    const choose=async path=>{
        if(leaving || busy)return
        setLeaving(true)
        await new Promise(resolve=>setTimeout(resolve,450))
        try{await onStart(path)}catch{setLeaving(false)}
    }
    return <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Choose your first activity" className={`onboarding-choice fixed inset-0 z-[190] flex flex-col items-center px-5 pt-4 pb-12 md:pt-6 md:pb-14 overflow-y-auto ${leaving?'onboarding-choice-leaving':''}`}>
        <div className="flex-1 shrink-0 w-full flex flex-col items-center justify-center gap-6 md:gap-9 pb-12">
        <div className="text-center shrink-0 flex flex-col items-center relative -top-2 md:-top-8"><img src={logoSmall} alt="Studium" className="size-10 object-contain mb-6" /><h1 className="text-3xl font-bold">Welcome to Studium</h1><p className="mt-2 text-sm text-neutral1">Explore the platform’s features through an interactive guide.</p></div>
        <div className="grid gap-4 md:gap-5 md:grid-cols-3 max-w-4xl w-full shrink-0" role="group" aria-label="Tutorial paths">{paths.map((path,index)=>{const {id,title,text,xp,Icon:PathIcon,color}=path;return <div key={id} className="motion-safe:animate-quest-float motion-reduce:animate-none" style={{animationDelay:`${index*-2}s`,'--quest-tilt':`${index===1?-1:1}deg`}}><button disabled={busy || leaving} aria-pressed={selectedPath===id} onClick={()=>setSelectedPath(id)} className={`onboarding-path w-full h-full text-neutral0 text-center rounded-3xl p-4 md:p-7 flex flex-col items-center gap-2 md:gap-4 border bg-neutral6 focus-visible:ring-4 focus-visible:ring-neutral4 cursor-pointer disabled:cursor-not-allowed ${selectedPath===id?'border-neutral2 ring-4 ring-neutral4':'border-neutral4'}`}>
            <span className="rounded-2xl size-14 md:size-16 flex items-center justify-center text-3xl md:text-4xl" style={{color,backgroundColor:`${color}18`}}><PathIcon aria-hidden="true" /></span><h2 className="text-xl font-semibold">{title}</h2><p className="text-sm text-neutral1 leading-relaxed flex-1">{text}</p><span className="flex items-center justify-center gap-1 text-amber-500 text-sm font-semibold"><PiStarFourFill aria-hidden="true" />+{xp} XP</span>
        </button></div>})}</div>
        </div>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <div className="shrink-0 flex items-center gap-3 w-full max-w-sm"><Button type="secondary" className="min-w-24 px-6 py-4" style={{borderRadius:9999}} disabled={busy || leaving} onClick={onSkip}>Skip</Button><Button type="primary" className="flex-1 py-4" style={{borderRadius:9999}} disabled={busy || leaving} onClick={()=>choose(selectedPath)}>Continue</Button></div>
    </div>
}
