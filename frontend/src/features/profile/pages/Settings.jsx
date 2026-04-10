import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../auth/contexts/AuthContext'
import Topbar from '../../../shared/components/ui/Topbar'
import Button from '../../../shared/components/ui/Button'

const Settings = () => {

    const { profile } = useOutletContext()
    const { logout } = useAuth()

    return (
        <div className='flex flex-col h-full overflow-scroll'>
            <Topbar profile={profile} />

            <div className='w-full flex-1 flex flex-col gap-4 px-24 pb-24 pt-2'>
                <h1 className='text-2xl font-semibold'>Settings</h1>

                <div>
                    <Button onClick={() => logout()}>
                        Log Out
                    </Button>
                </div>
            </div>
        </div>
    )
    
}

export default Settings