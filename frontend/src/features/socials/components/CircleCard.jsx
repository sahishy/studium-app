import Card from '../../../shared/components/ui/Card'
import AvatarStack from '../../../shared/components/avatar/AvatarStack'
import { useCircleMembers } from '../services/circleService'
import { useMembers } from '../contexts/MembersContext'
import { FaTrophy, FaUserGroup } from 'react-icons/fa6'
import CircleBanner from './CircleBanner'
const CircleCard = ({ circle, featured = false }) => {
    const { members } = useCircleMembers(circle.uid)
    const profiles = useMembers().filter(user => members.some(member => member.userId === user.uid))
    return <Card hoverable className={featured ? "p-6! sm:p-8! gap-6!" : ""}>
        <div className="flex gap-4 items-center"><CircleBanner banner={circle.profile.banner} className={featured ? "size-24 sm:size-28 shrink-0 rounded-2xl text-4xl" : "size-20 shrink-0 rounded-xl text-3xl"} /><div className="min-w-0 flex flex-col gap-2"><h3 className={`font-semibold truncate pr-8 ${featured ? "text-xl sm:text-2xl" : ""}`}>{circle.profile.title}</h3>{circle.profile.flair && <span className="text-xs text-neutral1">{circle.profile.flair}</span>}<p className="text-sm text-neutral1 flex items-center gap-2"><FaTrophy />{Number(circle.totalElo) || 0} ELO</p><p className="text-sm text-neutral1 flex items-center gap-2"><FaUserGroup />{circle.memberCount} members</p></div></div>
        <AvatarStack users={profiles} totalCount={circle.memberCount} maxVisible={4} sizeClassName={featured ? "size-12!" : "size-10"} overlapClassName="-space-x-3" />
    </Card>
}
export default CircleCard
