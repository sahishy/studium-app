import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import PageHeader from '../../../shared/components/ui/PageHeader'
import TextTabSelector from '../../../shared/components/ui/TextTabSelector'
import Button from '../../../shared/components/ui/Button'
import BottomFade from '../../../shared/components/ui/BottomFade'
import { FaArrowLeft, FaUser, FaUserPlus } from 'react-icons/fa6'
import { useModal } from '../../../shared/contexts/ModalContext'
import AddFriendModal from '../components/modals/AddFriendModal'
import { useFriends } from '../contexts/FriendsContext'

const tabs = [
    { name: 'all', label: 'Friends' },
    { name: 'incoming', label: 'Incoming' },
]

const Friends = () => {

    const navigate = useNavigate()
    const { profile } = useOutletContext()
    const location = useLocation()
    const { openModal, closeModal } = useModal()
    const { incomingRequests } = useFriends()

    const activeTabName = location.pathname.split('/')[3]
    const matchedTabIndex = tabs.findIndex((tab) => tab.name === activeTabName)
    const currentTab = matchedTabIndex >= 0 ? matchedTabIndex : 0

    const handleTabClick = (tabName) => {
        navigate(`/socials/friends/${tabName}`)
    }

    const handleAddFriend = () => {
        openModal(<AddFriendModal profile={profile} closeModal={closeModal} />)
    }

    return (
        <div className='flex flex-col h-full overflow-scroll'>
            <Topbar profile={profile} />

            <div className='w-full flex-1 flex flex-col gap-4 px-24 pb-24 pt-2'>
                <div className='flex justify-between items-start'>

                    {/* <Button
                        onClick={() => navigate('/socials')}
                    >
                        <FaArrowLeft />
                        Back
                    </Button> */}

                    <PageHeader text={'Friends'} icon={FaUserPlus} />

                    <div className='flex items-center gap-3'>
                        <Button type='secondary' onClick={handleAddFriend}>Add Friend</Button>
                        <TextTabSelector
                            tabs={tabs}
                            currentIndex={currentTab}
                            onSelect={(tab) => handleTabClick(tab.name)}
                            notificationTabs={incomingRequests.length > 0 ? ['incoming'] : null}
                        />
                    </div>

                </div>

                <Outlet context={{ profile }} />

                <BottomFade />
            </div>
        </div>
    )
}

export default Friends
