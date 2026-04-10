import { useOutletContext } from 'react-router-dom'
import TaskEditor from '../components/TaskEditor'
import BottomPadding from '../../../shared/components/ui/BottomPadding'

const ListTab = () => {
    const { profile } = useOutletContext()
    return <>
        <TaskEditor profile={profile} />
        <BottomPadding/>
    </>

}

export default ListTab