import { MdDeleteOutline } from 'react-icons/md'
import Card from '../../../shared/components/ui/Card'
import { FaBook } from 'react-icons/fa6'
import { FaChalkboardTeacher, FaExternalLinkAlt } from 'react-icons/fa'
import { SUBJECT_ICONS } from '../utils/courseUtils'
import { useNavigate } from 'react-router-dom'
import { hexToRgba } from '../../../shared/utils/colorUtils'

const MyCoursesCard = ({ course, customization, teacherName, loading = false }) => {

    const navigate = useNavigate();

    const color = customization?.color ?? '#f3f4f6'
    const SubjectIcon = SUBJECT_ICONS[course.subject];

    const openCourse = () => {
        navigate(`/courses/all/${course.courseId}`)
    }

    return (
        <button onClick={openCourse} className='w-full text-left'>
            <Card hoverable>
                <div
                    className={`h-28 rounded-xl flex items-center justify-center text-neutral2`}
                    style={{ backgroundColor: hexToRgba(color, 0.2) }}
                >
                    <FaBook className='text-4xl' style={{ color: color }} />
                </div>

                <div className='flex flex-col gap-1'>
                    <p className='font-semibold text-neutral0 truncate'>{course.title}</p>
                    <p className='text-xs text-neutral1 truncate flex items-center gap-2'>
                        <SubjectIcon />
                        {course.subject}
                    </p>
                    {teacherName && (
                        <p className='text-xs text-neutral1 truncate flex items-center gap-2'>
                            <FaChalkboardTeacher /> {teacherName}
                        </p>
                    )}
                </div>
            </Card>
        </button >
    )
}

export default MyCoursesCard