import '../multiplayer/components/mobileGames.css'
import useMobileView from '../../shared/utils/useMobileView'
import useVisualViewport from '../../shared/utils/useVisualViewport'
import { useEffect, useMemo, useRef, useState } from 'react'
import QuestionPane from '../multiplayer/games/sat-classic/components/QuestionPane'
import GameHeader from '../multiplayer/games/sat-classic/components/GameHeader'
import MatchEndOverlay from '../multiplayer/games/sat-classic/components/MatchEndOverlay'
import ResultOverlay from '../multiplayer/games/sat-classic/components/ResultOverlay'
import MatchIntroOverlay from '../multiplayer/components/MatchIntroOverlay'
import CalculatorWindow from '../multiplayer/components/windows/CalculatorWindow'
import Topbar from '../../shared/components/ui/Topbar'
import Spotlight from './Spotlight'
import { SAT_CLASSIC_INITIAL_HEALTH } from '../multiplayer/games/sat-classic/utils/satClassicGameUtils'

const readTiming = (runId) => {
    try{return JSON.parse(sessionStorage.getItem(`tutorial-match:${runId}`)) || {startedAt:Date.now()}}catch{return {startedAt:Date.now()}}
}
const saveTiming = (runId,timing) => {
    try{sessionStorage.setItem(`tutorial-match:${runId}`,JSON.stringify(timing))}catch{/* Cosmetic timing can fall back in private browsing. */}
}
const QUESTIONS=[
    {module:'english',questionType:'mcq',difficulty:'Easy',paragraph:'Maya was eager to begin.',prompt:'In the sentence, “eager” most nearly means…',choices:[{id:'A',label:'tired'},{id:'B',label:'excited'},{id:'C',label:'confused'},{id:'D',label:'quiet'}]},
    {module:'math',questionType:'spr',difficulty:'Easy',prompt:'A notebook costs $8. What do three notebooks cost?',choices:[]},
]
const calculatorStep={id:'practice-calculator',kind:'action',target:'practice:calculator',text:'Try the calculator. Open it and enter 8 × 3.'}
const returnHomeStep={id:'practice-return-home',kind:'action',target:'match:return-home',text:'Great job! Return back to the lobby'}
// Local presentation only. The authenticated tutorial endpoint owns the two answers;
// no room, matchmaking, game results, or normal progression services are involved.
export default function PracticeMatch({run,profile,onAnswer,onReturn}){
    const mobile = useMobileView()
    const viewport = useVisualViewport()
    const round=run.practiceRound || 0,health=SAT_CLASSIC_INITIAL_HEALTH
    const [response,setResponse]=useState(''),[calculator,setCalculator]=useState(false),[opened,setOpened]=useState(false),[hint,setHint]=useState(''),[busy,setBusy]=useState(false)
    const [now,setNow]=useState(Date.now),[roundStart,setRoundStart]=useState(()=>Date.now()),[result,setResult]=useState(null)
    const [showReturnGuidance,setShowReturnGuidance]=useState(false)
    const [returning,setReturning]=useState(false)
    const onReturnRef=useRef(onReturn)
    onReturnRef.current=onReturn
    const timing=useRef(readTiming(run.id))
    const endedAt=useRef(timing.current.endedAt || null)
    const startedAt=useRef(timing.current.startedAt),introEndsAt=useRef(round===0?Date.now()+3500:0)
    const localPlayer=useMemo(()=>({userId:profile.uid,...profile.profile,name:profile.profile.displayName,level:profile.progress?.level || 1}),[profile])
    const opponent=useMemo(()=>({userId:'tutorial-bot',displayName:'Studium',name:'Studium',avatar:{color:'#9ca3af',face:0},level:1}),[])
    const players=useMemo(()=>[localPlayer,opponent],[localPlayer,opponent])
    useEffect(()=>{saveTiming(run.id,timing.current)},[run.id])
    useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),50);return()=>clearInterval(timer)},[])
    const resultActive=!!result && now<result.startedAtMs+3000
    useEffect(()=>{
        if(!result || resultActive)return
        setResult(null);setResponse('');setHint('');setRoundStart(Date.now())
    },[result,resultActive])
    const countdownEnd=roundStart+(round===0?3500+3000:0)
    const countdownRemaining=Math.max(0,Math.min(3000,countdownEnd-now))
    const showCountdown=round===0 && !result && countdownRemaining>0
    // Wait for the result cleanup to reset roundStart before mounting guidance.
    // Otherwise the previous round's timestamp briefly makes it visible early.
    const math=round===1 && !result
    const finished=round>=2 && !resultActive
    useEffect(()=>{
        if(!finished)return
        const timer=setTimeout(()=>setShowReturnGuidance(true),10000)
        return()=>clearTimeout(timer)
    },[finished])
    useEffect(()=>{
        if(!returning)return
        const delay=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:534
        const timer=setTimeout(()=>void onReturnRef.current(),delay)
        return()=>clearTimeout(timer)
    },[returning])
    const returnHome=()=>{
        if(returning)return
        if(showReturnGuidance)setReturning(true)
        else void onReturn()
    }
    const question=QUESTIONS[resultActive?result.questionIndex:Math.min(round,1)]
    const submit=async()=>{
        if(busy || resultActive || showCountdown)return
        if(round===0 && response!=='B'){setHint('“Eager” means excited to do something. Try again.');return}
        if(round===1 && Number(response)!==24){setHint('Each notebook costs $8. Try multiplying 8 by 3.');return}
        if(round===1 && !opened)return
        setBusy(true)
        try{
            await onAnswer(response,opened)
            const timestamp=Date.now()
            if(round===1){endedAt.current=timestamp;saveTiming(run.id,{startedAt:startedAt.current,endedAt:timestamp})}
            setResult({type:'round_result',startedAtMs:timestamp,durationMs:3000,questionIndex:round,correctAnswer:round===0?'B':'24',
                myResult:{userId:profile.uid,isCorrect:true,damageRaw:health/2,baseDamage:health/2,timeMultiplier:1,roundMultiplier:1},
                opponentResult:{userId:opponent.userId,isCorrect:false,damageRaw:0}})
            setCalculator(false);setHint('')
        }catch(err){setHint(err.message)}finally{setBusy(false)}
    }
    const rounds=QUESTIONS.map((question,index)=>({id:`practice-${index}`,kind:'question',title:`Question ${index+1}`,question,submittedResponse:index===0?'B':'24',correctAnswer:index===0?'B':'24',isCorrect:true,winnerUserIds:[profile.uid]}))
    return <div style={mobile ? {height:viewport.height} : undefined} className="mp-room relative flex flex-col h-full overflow-hidden" role="region" aria-label="SAT Classic match">
        <Topbar profile={profile} showGameAction={finished} isGameFinished={finished} onReturnHome={returnHome} />
        <div className="mp-room-content w-full flex-1 min-h-0 px-8 xl:px-12 pb-8 pt-2 flex items-center justify-center">
            <div className="mp-room-game relative w-full max-w-[88rem] h-full min-h-[420px] flex flex-col gap-2">
                {finished ? <MatchEndOverlay userId={profile.uid} winnerUserId={profile.uid} modeId="sat-classic" localPlayer={localPlayer} opponent={opponent} players={players} rounds={rounds} matchDurationSeconds={((endedAt.current || startedAt.current)-startedAt.current)/1000} questionsAnswered={2} reasonLabel="You bested your opponent." showSkillComparison={false} showRankSection={false} /> : <div className="mp-game w-full h-full min-h-[420px] flex flex-col gap-12">
                    <GameHeader healthBoard={{leftPlayer:{...localPlayer,health},rightPlayer:{...opponent,health:Math.max(0,health*(1-round/2))}}} damageIndicators={{left:null,right:result?{amount:health/2,startedAtMs:result.startedAtMs}:null}} elapsedSeconds={Math.min(120,Math.max(0,120-Math.floor((now-countdownEnd)/1000)))} currentRoundMultiplier={1} nowMs={now} />
                    <div className="relative flex-1 flex min-h-0">
                        <QuestionPane currentQuestion={question} gameState={{questionIndex:resultActive?result.questionIndex:round}} submittedResponse={response} isSprQuestion={question.questionType==='spr'} isCalculatorOpen={calculator} onToggleCalculator={()=>{setCalculator(v=>!v);setOpened(true)}} onChoiceSelect={choice=>{setResponse(typeof choice==='string'?choice:choice.id);setHint('')}} onResponseChange={value=>{setResponse(value);setHint('')}} onSubmit={submit} isBusy={busy || resultActive || showCountdown} submitDisabled={math && !opened} />
                        <ResultOverlay activeOverlayMode={resultActive?'round_result':showCountdown?'round_start':null} roundCountdown={Math.ceil(countdownRemaining/1000)} roundOverlayRemainingMs={countdownRemaining} resultOverlay={result} nowMs={now} currentQuestion={question} players={players} />
                        {round===0 && <MatchIntroOverlay players={players} userId={profile.uid} modeId="sat-classic" introEndsAt={introEndsAt.current} placementByUserId={{[profile.uid]:{placed:false},[opponent.userId]:{placed:false}}} />}
                        {hint && <p role="alert" className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-xl bg-neutral5 border border-neutral3 shadow-lg p-3 text-sm max-w-sm">{hint}</p>}
                    </div>
                </div>}
            </div>
        </div>
        <CalculatorWindow isOpen={calculator} onClose={()=>setCalculator(false)} />
        {math && !showCountdown && !resultActive && <Spotlight step={calculatorStep} visible={!opened && now>=countdownEnd+1000} onRetry={()=>{}} />}
        {finished && <Spotlight step={returnHomeStep} visible={showReturnGuidance && !returning} onRetry={()=>{}} />}
    </div>
}
