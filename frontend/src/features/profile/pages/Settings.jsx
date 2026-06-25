import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../auth/contexts/AuthContext'
import { updateUserPreference } from '../../auth/services/userService'
import Topbar from '../../../shared/components/ui/Topbar'
import Button from '../../../shared/components/ui/Button'
import PageHeader from '../../../shared/components/ui/PageHeader'
import { FaGear } from 'react-icons/fa6'
import BottomFade from '../../../shared/components/ui/BottomFade'

const DetailRow = ({ label, value, action }) => {

    return (
        <div className='py-3'>
            <div className='flex items-start justify-between gap-6'>

                <div>
                    <p className='text-sm font-semibold text-neutral0'>{label}</p>
                    {value ? <p className='text-sm text-neutral1'>{value}</p> : null}
                </div>

                {/* {action && (
                    <button
                        type='button'
                        className={`text-sm font-semibold transition-colors text-neutral2 cursor-not-allowed`}
                    >
                        {action}
                    </button>
                )} */}

            </div>
        </div>
    )

}

const Settings = () => {

    const { profile } = useOutletContext()
    const { logout } = useAuth()
    const [selectedTheme, setSelectedTheme] = useState('light')

    const resolvedName = useMemo(() => {
        const first = String(profile?.firstName ?? '').trim()
        const last = String(profile?.lastName ?? '').trim()
        const combined = `${first} ${last}`.trim()
        return combined || profile?.profile?.displayName || '—'
    }, [profile])

    const resolvedEmail = profile?.email || '—'
    const preferenceTheme = profile?.preferences?.theme

    useEffect(() => {
        const activeTheme = preferenceTheme === 'dark' ? 'dark' : 'light'
        setSelectedTheme(activeTheme)
        document.documentElement.classList.toggle('dark', activeTheme === 'dark')
    }, [preferenceTheme])

    const handleThemeChange = async (theme) => {
        if (!profile?.uid || theme === selectedTheme) {
            return
        }

        setSelectedTheme(theme)
        document.documentElement.classList.toggle('dark', theme === 'dark')

        try {
            await updateUserPreference(profile.uid, 'theme', theme)
        } catch (error) {
            console.error('Failed to update theme preference:', error)
        }
    }

    return (
        <div className='flex flex-col h-full overflow-scroll'>
            <Topbar profile={profile} />
            <div className='w-full max-w-3xl mx-auto flex-1 flex flex-col gap-12'>

                <PageHeader text={'Settings'} icon={FaGear} />

                <section className='flex flex-col gap-6'>
                    <h2 className='text-xl font-semibold text-neutral0'>Personal Details</h2>

                    <div className='divide-y divide-neutral4'>
                        <DetailRow label='Name' value={resolvedName} action='Edit' />
                        <DetailRow label='Email address' value={resolvedEmail} action='Edit' />
                        <DetailRow label='Password' value='••••••••' action='Edit' />
                    </div>

                </section>

                <section className='flex flex-col gap-6'>
                    <h2 className='text-xl font-semibold text-neutral0'>Preferences</h2>

                    <div className='flex flex-col gap-3'>
                        <p className='text-sm font-semibold text-neutral0'>Appearance</p>

                        <div className='flex gap-3 flex-wrap'>

                            <button
                                type='button'
                                onClick={() => handleThemeChange('light')}
                                className={`relative w-44 h-32 rounded-xl bg-[#F3F4F6] border border-[#ebedf2] overflow-hidden
                                outline-neutral0 ${selectedTheme === 'light' ? 'outline-2' : 'outline-0'} cursor-pointer transition
                            `}
                            >
                                <div className='absolute -right-2 -bottom-2 w-38 h-26 rounded-xl bg-white border border-[#ebedf2] p-3'>
                                    <div className='text-[#1F2937] font-bold text-2xl text-start'>Aa</div>
                                </div>
                            </button>

                            <button
                                type='button'
                                onClick={() => handleThemeChange('dark')}
                                className={`relative w-44 h-32 rounded-xl bg-[#1c1c21] border border-[#26262c] overflow-hidden
                                outline-neutral0 ${selectedTheme === 'dark' ? 'outline-2' : 'outline-0'} cursor-pointer transition
                            `}
                            >
                                <div className='absolute -right-2 -bottom-2 w-38 h-26 rounded-xl bg-[#131316] border border-[#26262c] p-3'>
                                    <div className='text-white font-bold text-2xl text-start'>Aa</div>
                                </div>
                            </button>

                        </div>
                    </div>

                </section>

                <section className='flex flex-col gap-6'>
                    <h2 className='text-xl font-semibold text-neutral0'>Manage Account</h2>

                    <div className='flex items-center justify-between'>
                        <div>
                            <p className='font-semibold text-neutral0'>Log out</p>
                            <p className='text-sm text-neutral1'>Log out of your Studium account.</p>
                        </div>
                        <Button type='secondary' onClick={() => logout()}>
                            Log Out
                        </Button>
                    </div>

                </section>

            </div>
            <BottomFade />
        </div>
    )

}

export default Settings