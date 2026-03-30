import { useOutletContext } from 'react-router-dom'
import TaskEditor from '../../components/tasks/TaskEditor.jsx'

const ListTab = () => {
    const { profile } = useOutletContext()
    return <TaskEditor profile={profile} />
}

export default ListTab