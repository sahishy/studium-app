import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

const BaseTooltip = ({ children, content, className = '', delay = 0, placement = 'auto', disabled = false }) => {

    const gap = 4;
    const animationDuration = 150;

    const [isMounted, setIsMounted] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

    const tooltipRef = useRef(null);
    const triggerRef = useRef(null);
    const showTimeoutRef = useRef(null);
    const unmountTimeoutRef = useRef(null);

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
        if (disabled) return;

        if (showTimeoutRef.current) {
            clearTimeout(showTimeoutRef.current);
        }

        if (unmountTimeoutRef.current) {
            clearTimeout(unmountTimeoutRef.current);
        }

        showTimeoutRef.current = setTimeout(() => {
            setIsMounted(true);
            setIsOpen(false);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsOpen(true);
                });
            });

            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                const estimatedRect = { width: tooltipSize.width || 150, height: tooltipSize.height || 40 };
                const position = calculatePosition(rect, estimatedRect);
                setTooltipPosition(position);
            }
        }, delay);
    };

    const hideTooltip = () => {
        if (showTimeoutRef.current) {
            clearTimeout(showTimeoutRef.current);
        }

        if (unmountTimeoutRef.current) {
            clearTimeout(unmountTimeoutRef.current);
        }

        setIsOpen(false);
        unmountTimeoutRef.current = setTimeout(() => {
            setIsMounted(false);
        }, animationDuration);
    };

    useLayoutEffect(() => {
        if (isMounted && tooltipRef.current) {
            const rect = tooltipRef.current.getBoundingClientRect();
            setTooltipSize({ width: rect.width, height: rect.height });

            // calculate position immediately
            if (triggerRef.current) {
                const triggerRect = triggerRef.current.getBoundingClientRect();
                const position = calculatePosition(triggerRect, rect);
                setTooltipPosition(position);
            }
        }
    }, [isMounted]);

    useEffect(() => {
        return () => {
            if (showTimeoutRef.current) {
                clearTimeout(showTimeoutRef.current);
            }

            if (unmountTimeoutRef.current) {
                clearTimeout(unmountTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (disabled) {
            hideTooltip();
        }
    }, [disabled]);

    return (
        <div className={`relative ${className}`}>
            <div
                ref={triggerRef}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
                // onClick={hideTooltip}
                className={disabled ? '' : 'cursor-pointer'}
            >
                {children}
            </div>

            {!disabled && isMounted &&
                createPortal(
                    <div
                        ref={tooltipRef}
                        className={`
                            absolute z-[9999] pointer-events-none select-none
                            transition-all duration-150 ease-out transform
                            ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
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