import { Outlet, useLocation, useMatch, useNavigate, useOutletContext } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import TextTabSelector from '../../../shared/components/ui/TextTabSelector'
import { useRef } from 'react'
import BottomFade from '../../../shared/components/ui/BottomFade'
import Button from '../../../shared/components/ui/Button'
import { FaArrowLeft } from 'react-icons/fa6'

const tabs = [
    { name: 'me', label: 'My Courses' },
    { name: 'all', label: 'All Courses' },
]

const Courses = () => {

    const { profile } = useOutletContext()
    const location = useLocation();
    const navigate = useNavigate();
    const scrollRef = useRef(null)

    const activeTabName = location.pathname.split('/')[2] || tabs[0].name
    const currentTab = tabs.findIndex(tab => tab.name === activeTabName)
    const onOverviewPage = !!useMatch('/courses/all/:courseId')

    const getTabTitle = () => {
        const activeTab = tabs.find(tab => tab.name === activeTabName)
        return activeTab?.label || 'My Courses'
    }

    const handleClick = (tab) => {
        navigate(`/courses/${tab}`)
    }

    return (
        <div ref={scrollRef} className='flex flex-col h-full overflow-scroll'>
            <Topbar profile={profile} />

            <div className='w-full flex-1 flex flex-col gap-4 px-24 pb-24 pt-2'>
                <div className='flex justify-between items-start'>

                    {onOverviewPage ? (
                        <Button
                            onClick={() => navigate(-1)}
                        >
                            <FaArrowLeft />
                            Back
                        </Button>
                    ) : (
                        <h1 className='text-2xl font-semibold'>{getTabTitle()}</h1>
                    )}

                    <TextTabSelector
                        tabs={tabs}
                        currentIndex={currentTab}
                        onSelect={(tab) => handleClick(tab.name)}
                    />

                </div>
                <Outlet context={{ profile }} />
                <BottomFade scrollRef={scrollRef} />
            </div>
        </div>
    )
}

export default Courses