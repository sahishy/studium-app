import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

const BasePopover = ({ children, content, className = '', onOpen }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [popoverSize, setPopoverSize] = useState({ width: 0, height: 0 });
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
    const [animate, setAnimate] = useState(false);

    const popoverRef = useRef(null);
    const buttonRef = useRef(null);

    const togglePopover = () => {
        const willOpen = !isOpen;
        setIsOpen(willOpen);
        if (willOpen && onOpen) {
            onOpen();
        }
        if (willOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceRight = window.innerWidth - rect.left;

            const top = spaceBelow > 200
                ? rect.bottom + 8
                : rect.top - popoverSize.height - 8;
            const left = spaceRight > 200
                ? rect.left
                : rect.right - popoverSize.width;

            setPopoverPosition({ top, left });
        }
    };

    const closePopover = () => setIsOpen(false);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(event.target) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    useLayoutEffect(() => {
        if (isOpen && popoverRef.current) {
            const rect = popoverRef.current.getBoundingClientRect();
            setPopoverSize({ width: rect.width, height: rect.height });

            // calculate position immediately
            if (buttonRef.current) {
                const buttonRect = buttonRef.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - buttonRect.bottom;
                const spaceRight = window.innerWidth - buttonRect.left;

                const top = spaceBelow > rect.height + 16
                    ? buttonRect.bottom + 8
                    : Math.max(buttonRect.top - rect.height - 8, 8);

                const left = spaceRight > rect.width + 16
                    ? buttonRect.left
                    : Math.max(buttonRect.right - rect.width, 8);

                setPopoverPosition({ top, left });
            }
        } else {
            // reset animation when closed
            setAnimate(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => setAnimate(true), 10);
            return () => clearTimeout(timer);
        } else {
            setAnimate(false);
        }
    }, [isOpen]);

    return (
        <div className={`relative ${className}`}>
            <div
                ref={buttonRef}
                onClick={togglePopover}
                className="cursor-pointer"
            >
                {children(isOpen)}
            </div>

            {isOpen &&
                createPortal(
                    <>
                        <div
                            className="fixed inset-0 z-[1000]"
                            onClick={closePopover}
                        />
                        <div
                            ref={popoverRef}
                            className={`
                                absolute z-[1001] p-2 bg-white rounded-lg border-2 border-gray-200 shadow-lg shadow-gray-800/5
                                w-fit h-fit min-w-50

                                {/* tailwindcss-ignore-next-line */}
                                transition-opacity transition-transform duration-200 ease-out transform
                                
                                ${animate ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
                            `}
                            style={{
                                top: `${popoverPosition.top}px`,
                                left: `${popoverPosition.left}px`,
                                position: 'absolute'
                            }}
                        >
                            {content(closePopover)}
                        </div>
                    </>,
                    document.body
                )}
        </div>
    );
};

export default BasePopover;