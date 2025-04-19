const TasksHeader = () => {
    return (

        <div className={`w-full flex justify-between items-center gap-4 p-2 text-sm font-semibold text-gray-400`}>

            <h1 className="flex-2">Title</h1>

            <h1 className="flex-1">Subject</h1>

            <h1 className="flex-1">Due Date</h1>
            
            <h1 className="flex-1">Time Estimate</h1>

        </div>
    )
}

export default TasksHeader