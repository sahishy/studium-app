import { useEffect, useState } from "react";
import { FaCheck, FaCopy, FaUserFriends } from "react-icons/fa";
import Button from "../../main/Button";
import Card from "../../main/Card";

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
        <Card className={'flex-1'}>

           <div className="flex items-center gap-4">
                <div className="p-4 bg-sky-400/15 rounded-xl">
                    <FaUserFriends className="text-2xl text-sky-400"/>
                </div>

                <h1 className="text-xl font-extrabold text-text1 flex">Invite Friends&nbsp;

                    <div
                        onClick={() => {
                            navigator.clipboard.writeText(circle.inviteCode);
                            setCopied(true)
                        }}
                        className="flex items-center gap-2 group cursor-pointer text-text2"
                    >
                        <h1 className="font-extrabold text-xl">#{circle.inviteCode}</h1>
                        {copied ? (
                            <FaCheck className="text-sm hidden group-hover:block"/>
                        ) : (
                            <FaCopy className="text-sm hidden group-hover:block"/>
                        )}
                    </div>

                </h1>

            </div>

            <div className="flex items-center gap-2 text-text2 text-sm">

                <h1 className="text-text2">Or use a link: </h1>&nbsp;

                <Button onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/#/join/${circle.inviteCode}`);
                    setCopiedAlt(true)
                }} type={'secondary'}>
                    {copiedAlt ? 'Copied' : 'Copy Link'}
                </Button>

            </div>

        </Card>
    )
}

export default CircleInvite