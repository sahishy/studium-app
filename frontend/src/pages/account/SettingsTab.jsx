import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/main/Button';

const SettingsTab = () => {

    const { profile } = useOutletContext()
    const { logout } = useAuth()

    return (
        <div className='flex flex-col gap-4'>

            <div>
                <Button onClick={() => logout()}>
                    Log Out
                </Button>                
            </div>

        </div>
    )
}

export default SettingsTab
