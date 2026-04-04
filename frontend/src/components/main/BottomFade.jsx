import { useEffect, useState } from "react";
import { FaArrowUp } from "react-icons/fa6";
import Button from "./Button";

const BottomFade = ({ scrollRef }) => {

    const [isVisible, setIsVisible] = useState(false);
    const THRESHOLD = 64;

    useEffect(() => {

        const scrollElement = scrollRef?.current;
        if (!scrollElement) return;

        const handleScroll = () => {
            setIsVisible(scrollElement.scrollTop > THRESHOLD);
        };

        scrollElement.addEventListener("scroll", handleScroll);
        handleScroll();

        return () => {
            scrollElement.removeEventListener("scroll", handleScroll);
        };

    }, [scrollRef]);

    const scrollToTop = () => {

        const scrollElement = scrollRef?.current;
        if(!scrollElement) return;

        scrollElement.scrollTo({
            top: 0,
            behavior: "smooth",
        });

    };

    return (
        <>
            <Button
                type="tertiary"
                disabled={!isVisible}
                onMouseDown={(e) => e.preventDefault()}
                onClick={scrollToTop}
                className="p-3! justify-self-center absolute bottom-16 left-0 right-0 shadow-lg shadow-shadow
                    opacity-100 disabled:opacity-0! disabled:pointer-events-none transition-opacity"
            >
                <FaArrowUp />
            </Button>

            <div className="ml-64 pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-neutral6 to-transparent" />
        </>
    );
};

export default BottomFade;