import { useOutletContext } from 'react-router-dom'
import TaskEditor from '../../components/tasks/TaskEditor.jsx'
import BottomPadding from '../../components/main/BottomPadding.jsx'

const ListTab = () => {
    const { profile } = useOutletContext()
    return <>
        <TaskEditor profile={profile} />
        <BottomPadding/>
    </>

}

export default ListTab