import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const SettingsTab = () => {

    const { profile } = useOutletContext()
    const { logout } = useAuth()

    return (
        <div className='flex flex-col gap-4'>

        </div>
    )
}

export default SettingsTab
