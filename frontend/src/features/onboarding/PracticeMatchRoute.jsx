import { Navigate, useOutletContext, useParams } from 'react-router-dom'
import { useOnboarding } from './OnboardingContext'
import PracticeMatch from './PracticeMatch'
export default function PracticeMatchRoute(){
    const {profile}=useOutletContext(), {runId}=useParams()
    const {active,step,ready,practiceActions}=useOnboarding()
    if(!ready)return null
    if(!active)return <Navigate to="/play" replace />
    if(active.id!==runId || step?.id!=='practice')return <Navigate to={step?.route || '/play'} replace />
    if(!practiceActions)return null
    return <PracticeMatch run={active} profile={profile} {...practiceActions} />
}
