import { useOutletContext } from "react-router-dom";

const CalendarTab = () => {

    const { profile } = useOutletContext();

    return (
        <div className="w-full flex flex-col gap-4">

            <h1 className='text-text2'>Coming soon!</h1>

        </div>
    )
}


export default CalendarTab