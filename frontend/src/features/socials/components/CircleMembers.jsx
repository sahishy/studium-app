import CircleMember from "./CircleMember";

const CircleMembers = ( { members, ownerId } ) => {

    return (
        <div className="flex gap-4">

            <div className='w-full grid grid-cols-4 auto-rows-auto gap-2'>

                {members.sort((a, b) => (b.status === 'active') - (a.status === 'active')).map((member, index) => (

                    <CircleMember key={index} profile={member} isOwner={member.uid === ownerId}/>

                ))}

            </div>

        </div>
    )

}

export default CircleMembers