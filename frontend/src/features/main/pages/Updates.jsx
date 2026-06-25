import { useOutletContext } from "react-router-dom"
import PageHeader from "../../../shared/components/ui/PageHeader"
import Topbar from "../../../shared/components/ui/Topbar"
import { FaCircleInfo } from "react-icons/fa6"
import BottomPadding from "../../../shared/components/ui/BottomPadding"
import BottomFade from "../../../shared/components/ui/BottomFade"
import { useRef } from "react"

const updates = [
    {
        version: "v1.09",
        date: "TBD",
        changes: [
            "Added friends system",
            "Added study circles and competitive circles",
            "Added settings screen with theme selection",
            "Improved teacher search to include all parts of names",
            "Fixed various task management system bugs",
            "Added natural language date parsing for Month Nth format (e.g. May 10th)",
            "Replaced Ranked page with Play page",
            "Added game mode selection",
            "Added mode types to support singleplayer and multiplayer modes",
            "Added Blitz mode",
            "Added Updates page"
        ]
    },
    {
        version: "v1.08",
        date: "May 10, 2026",
        changes: [
            "Added course caching",
            "Added persistent offline cache",
            "Reduced loading times across courses",
            "Optimized database reads and writes",
            "Improved overall app performance"
        ]
    },
    {
        version: "v1.07",
        date: "May 9, 2026",
        changes: [
            "Improved task caching reliability",
            "Added optimistic task creation and deletion",
            "Improved synchronization after reconnecting",
            "Fixed task management issues",
            "General performance improvements"
        ]
    },
    {
        version: "v1.06",
        date: "May 9, 2026",
        changes: [
            "Added course editing",
            "Added review pagination",
            "Improved course loading states",
            "Fixed course rating issues"
        ]
    },
    {
        version: "v1.05",
        date: "May 9, 2026",
        changes: [
            "Completed the course overview experience",
            "Added course limits",
            "Improved course management"
        ]
    },
    {
        version: "v1.04",
        date: "May 9, 2026",
        changes: [
            "Added task limits",
            "Improved task performance",
            "Reduced unnecessary database writes",
            "Added local task caching"
        ]
    },
    {
        version: "v1.03",
        date: "May 3, 2026",
        changes: [
            "Improved task organization options",
            "Added drag-and-drop task management",
            "Added empty-state illustrations",
            "Improved profile pages",
            "Refreshed course overview design"
        ]
    },
    {
        version: "v1.02",
        date: "Apr 27, 2026",
        changes: [
            "Started task system redesign",
            "Improved foundation for future task features"
        ]
    },
    {
        version: "v1.01",
        date: "Apr 19, 2026",
        changes: [
            "Added landing page",
            "Added signup and login",
            "Added school onboarding flow",
            "Improved deployment reliability"
        ]
    },
    {
        version: "v1.00",
        date: "Apr 19, 2026",
        changes: [
            "Initial Studium release",
            "Added SAT game",
            "Added room chat",
            "Added authentication",
            "Added Firebase infrastructure"
        ]
    }
]

const Updates = () => {

    const { profile } = useOutletContext()
    const scrollRef = useRef(null)

    return (
        <div ref={scrollRef}className='flex flex-col h-full overflow-scroll'>
            <Topbar profile={profile} />

            <div className='w-full max-w-3xl mx-auto flex-1 flex flex-col gap-16 pb-12'>
                <PageHeader text={'Updates'} icon={FaCircleInfo} />

                <div className='flex flex-col gap-8'>
                    {updates.map((update) => (
                        <div key={update.version}>

                            <div className='flex items-center justify-between mb-3'>
                                <h2 className='font-semibold text-lg'>
                                    {update.version}
                                </h2>

                                <span className='text-sm text-neutral1'>
                                    {update.date}
                                </span>
                            </div>

                            <ul className='flex flex-col gap-1'>
                                {update.changes.map((change) => (
                                    <li
                                        key={change}
                                        className='text-sm text-secondary list-disc ml-5'
                                    >
                                        {change}
                                    </li>
                                ))}
                            </ul>

                        </div>
                    ))}
                </div>
            </div>

            <BottomFade scrollRef={scrollRef}/>
            <BottomPadding />
        </div>
    )
}

export default Updates