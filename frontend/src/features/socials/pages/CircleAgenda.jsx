import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import IconTabSelector from '../../../shared/components/ui/IconTabSelector'
import { upsertWidget, buildCircleWidgetSegment } from '../../agenda/utils/taskWidgetControlUtils'
import { FaCalendar, FaList, FaTh } from 'react-icons/fa'
import { resolveAgendaPreferences } from '../../agenda/utils/agendaPreferences'
import { updateAgendaPreferences } from '../../agenda/services/taskService'

const tabs = [
    { name: 'list', label: 'List', icon: <FaList /> },
    { name: 'board', label: 'Board', icon: <FaTh /> },
    { name: 'calendar', label: 'Calendar', icon: <FaCalendar /> },
]

const CircleAgenda = () => {

    const { profile, circleId, circle } = useOutletContext()
    const location = useLocation()
    const navigate = useNavigate()
    const [agendaPreferences, setAgendaPreferences] = useState(() => resolveAgendaPreferences(profile))

    useEffect(() => setAgendaPreferences(resolveAgendaPreferences(profile)), [profile])

    const saveAgendaPreferences = async (nextPreferences) => {
        await updateAgendaPreferences(profile.uid, nextPreferences)
        setAgendaPreferences(nextPreferences)
    }

    const activeTabName = tabs.find((tab) => location.pathname.includes(`/${tab.name}`))?.name || 'list'
    const currentTab = tabs.findIndex((tab) => tab.name === activeTabName)

    const handleTabClick = (tabName) => {
        navigate(`/socials/circle/${circleId}/agenda/${tabName}`)
        localStorage.setItem('circleAgenda:lastTab', tabName)
    }

    const injectCircleWidget = (title) => {
        const nextTitle = upsertWidget({
            title,
            widgetType: 'circle',
            builder: (existing) => buildCircleWidgetSegment({
                currentSegment: existing,
                circleId,
                circles: [circle],
                fallbackLabel: circle?.title || '',
            }),
        })

        const segments = Array.isArray(nextTitle?.segments) ? [...nextTitle.segments] : []
        const widgetIndex = segments.findIndex((segment) => segment?.type === 'widget' && segment?.widgetType === 'circle')
        if (widgetIndex <= 0) return nextTitle

        const prev = segments[widgetIndex - 1]
        const prevText = typeof prev?.rawText === 'string' ? prev.rawText : ''
        if (prev?.type === 'text' && prevText.endsWith(' ')) return nextTitle

        if (prev?.type === 'text') {
            segments[widgetIndex - 1] = {
                ...prev,
                rawText: `${prevText} `,
                displayText: typeof prev.displayText === 'string' ? `${prev.displayText} ` : `${prevText} `,
            }
            return { ...nextTitle, segments }
        }

        segments.splice(widgetIndex, 0, { type: 'text', rawText: ' ', displayText: ' ' })
        return { ...nextTitle, segments }
    }

    return (
        <div className={`w-full flex flex-col gap-4 ${activeTabName === 'list' ? '' : 'h-[calc(100dvh-260px)] min-h-[420px]'}`}>

            <div className='w-full flex justify-center sm:justify-end'>
                <IconTabSelector
                    tabs={tabs}
                    currentIndex={currentTab >= 0 ? currentTab : 0}
                    onSelect={(tab) => handleTabClick(tab.name)}
                />
            </div>

            <div className={activeTabName === 'list' ? 'w-full' : 'min-h-0 w-full flex-1'}>
                <Outlet context={{
                    profile,
                    circleId,
                    circle,
                    isCircleView: true,
                    hideCircleWidgetControl: true,
                    forceCircleWidget: injectCircleWidget,
                    agendaPreferences,
                    saveAgendaPreferences,
                }} />
            </div>
            
        </div>
    )

}

export default CircleAgenda
