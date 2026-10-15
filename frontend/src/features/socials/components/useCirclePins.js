import { useEffect, useMemo, useState } from 'react'
const readPins = key => {try {const value=JSON.parse(localStorage.getItem(key));return Array.isArray(value) ? value.filter(v=>typeof v==='string') : []}catch{return []}}
export function useCirclePins(uid,circles,confirmed) {
    const key=`sidebar:circlePins:${uid}`
    const [pins,setPins]=useState(()=>readPins(key))
    useEffect(()=>{setPins(readPins(key));const listener=e=>{if(e.detail===key)setPins(readPins(key))};window.addEventListener('sidebar:pins-changed',listener);return()=>window.removeEventListener('sidebar:pins-changed',listener)},[key])
    const valid=useMemo(()=>pins.filter(id=>circles.some(c=>c.uid===id)),[pins,circles])
    useEffect(()=>{if(confirmed && valid.length!==pins.length){setPins(valid);try{localStorage.setItem(key,JSON.stringify(valid))}catch{/* memory fallback */}}},[valid,key,pins,confirmed])
    const toggle=id=>{
        const next=pins.includes(id)?pins.filter(v=>v!==id):[...pins,id]
        setPins(next)
        try{localStorage.setItem(key,JSON.stringify(next));window.dispatchEvent(new CustomEvent('sidebar:pins-changed',{detail:key}))}catch{/* memory fallback */}
    }
    return {pins:valid,toggle}
}
