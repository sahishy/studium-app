import { useEffect, useState } from "react";
import { FaCheck, FaCopy, FaUserFriends } from "react-icons/fa";

const CircleInvite = ( { circle } ) => {

    const [copied, setCopied] = useState(false);
    const [copiedAlt, setCopiedAlt] = useState(false);

    useEffect(() => {
        if(copied === true) {
            setTimeout(() => {
                setCopied(false)
            }, 1000)
        }
    }, [copied])

    useEffect(() => {
        if(copiedAlt === true) {
            setTimeout(() => {
                setCopiedAlt(false)
            }, 1000)
        }
    }, [copiedAlt])

    return (
        <div className="flex-1 flex flex-col gap-4 p-4 bg-white rounded-lg border-2 border-gray-200">

           <div className="flex items-center gap-4">
                <div className="p-4 bg-gray-100 rounded-lg">
                    <FaUserFriends className="text-2xl text-sky-400"/>
                </div>

                <h1 className="text-2xl font-extrabold flex">Invite Friends&nbsp;

                    <div
                        onClick={() => {
                            navigator.clipboard.writeText(circle.inviteCode);
                            setCopied(true)
                        }}
                        className="flex items-center gap-2 group cursor-pointer text-gray-400"
                    >
                        <h1 className="font-extrabold text-2xl">#{circle.inviteCode}</h1>
                        {copied ? (
                            <FaCheck className="text-sm hidden group-hover:block"/>
                        ) : (
                            <FaCopy className="text-sm hidden group-hover:block"/>
                        )}
                    </div>

                </h1>

            </div>

            <div className="flex items-center gap-2 text-gray-400 text-sm">

                <h1 className="text-gray-400">Or use a link: </h1>&nbsp;

                <button
                    onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/#/join/${circle.inviteCode}`);
                        setCopiedAlt(true)
                    }}
                    className='px-4 py-2 border-2 border-gray-200 border-b-4 rounded-lg flex gap-2 items-center hover:bg-gray-800/5 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                >
                    {copiedAlt ? 'Copied' : 'Copy Link'}
                </button>
            </div>

        </div>
    )
}

export default CircleInvite