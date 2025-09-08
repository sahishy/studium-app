import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

const BaseTooltip = ({ children, content, className = '', delay = 0, placement = 'auto' }) => {

    const gap = 4;

    const [isVisible, setIsVisible] = useState(false);
    const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const [animate, setAnimate] = useState(false);

    const tooltipRef = useRef(null);
    const triggerRef = useRef(null);
    const timeoutRef = useRef(null);

    const calculatePosition = (triggerRect, tooltipRect) => {
        let top, left;

        if (placement === 'top') {
            top = triggerRect.top - tooltipRect.height - gap;
            left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        } else if (placement === 'bottom') {
            top = triggerRect.bottom + gap;
            left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        } else if (placement === 'left') {
            top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
            left = triggerRect.left - tooltipRect.width - gap;
        } else if (placement === 'right') {
            top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
            left = triggerRect.right + gap;
        } else { // auto
            const spaceBelow = window.innerHeight - triggerRect.bottom;
            top = spaceBelow > tooltipRect.height + (gap * 2)
                ? triggerRect.bottom + gap
                : triggerRect.top - tooltipRect.height - gap;
            left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        }

        // Keep within viewport bounds
        left = Math.max(gap, Math.min(left, window.innerWidth - tooltipRect.width - gap));
        top = Math.max(gap, Math.min(top, window.innerHeight - tooltipRect.height - gap));

        return { top, left };
    };

    const showTooltip = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            const willShow = !isVisible;
            setIsVisible(willShow);
            if (willShow && triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                const estimatedRect = { width: tooltipSize.width || 150, height: tooltipSize.height || 40 };
                const position = calculatePosition(rect, estimatedRect);
                setTooltipPosition(position);
            }
        }, delay);
    };

    const hideTooltip = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsVisible(false);
    };

    useLayoutEffect(() => {
        if (isVisible && tooltipRef.current) {
            const rect = tooltipRef.current.getBoundingClientRect();
            setTooltipSize({ width: rect.width, height: rect.height });

            // calculate position immediately
            if (triggerRef.current) {
                const triggerRect = triggerRef.current.getBoundingClientRect();
                const position = calculatePosition(triggerRect, rect);
                setTooltipPosition(position);
            }
        } else {
            // reset animation when closed
            setAnimate(false);
        }
    }, [isVisible]);

    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => setAnimate(true), 10);
            return () => clearTimeout(timer);
        } else {
            setAnimate(false);
        }
    }, [isVisible]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <div className={`relative ${className}`}>
            <div
                ref={triggerRef}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
                className="cursor-pointer"
            >
                {children}
            </div>

            {isVisible &&
                createPortal(
                    <div
                        ref={tooltipRef}
                        className={`
                            absolute z-[9999] py-1 px-2 bg-background0 border-1 border-border text-text0 text-xs rounded-xl
                            pointer-events-none select-none

                            transition-transform duration-200 ease-out transform
                            
                            ${animate ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
                        `}
                        style={{
                            top: `${tooltipPosition.top}px`,
                            left: `${tooltipPosition.left}px`,
                            position: 'fixed'
                        }}
                    >
                        {content}
                    </div>,
                    document.body
                )}
        </div>
    )
}

export default BaseTooltip