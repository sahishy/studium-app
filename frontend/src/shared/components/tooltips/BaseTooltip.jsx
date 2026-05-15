import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

const BaseTooltip = ({ children, content, className = '', delay = 0, placement = 'auto', disabled = false, open = undefined }) => {

    const gap = 4;
    const animationDuration = 150;

    const [phase, setPhase] = useState('hidden');
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

    const tooltipRef = useRef(null);
    const triggerRef = useRef(null);
    const showTimeoutRef = useRef(null);
    const hideTimeoutRef = useRef(null);
    const isControlled = typeof open === 'boolean';

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
        } else {
            const spaceBelow = window.innerHeight - triggerRect.bottom;
            top = spaceBelow > tooltipRect.height + (gap * 2)
                ? triggerRect.bottom + gap
                : triggerRect.top - tooltipRect.height - gap;
            left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        }

        left = Math.max(gap, Math.min(left, window.innerWidth - tooltipRect.width - gap));
        top = Math.max(gap, Math.min(top, window.innerHeight - tooltipRect.height - gap));

        return { top, left };
    };

    useLayoutEffect(() => {
        if (phase !== 'measuring' || !tooltipRef.current || !triggerRef.current) return;

        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const triggerRect = triggerRef.current.getBoundingClientRect();

        setTooltipPosition(calculatePosition(triggerRect, tooltipRect));
        setPhase('visible');
    }, [phase]);

    const showTooltip = () => {
        if (disabled) return;
        clearTimeout(showTimeoutRef.current);
        clearTimeout(hideTimeoutRef.current);

        showTimeoutRef.current = setTimeout(() => {
            setPhase('measuring');
        }, delay);
    };

    const hideTooltip = () => {
        clearTimeout(showTimeoutRef.current);
        clearTimeout(hideTimeoutRef.current);
        setPhase('hidden');
    };

    useEffect(() => {
        return () => {
            clearTimeout(showTimeoutRef.current);
            clearTimeout(hideTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (disabled) hideTooltip();
    }, [disabled]);

    useEffect(() => {
        if (!isControlled || disabled) return;
        clearTimeout(showTimeoutRef.current);
        clearTimeout(hideTimeoutRef.current);
        setPhase(open ? 'measuring' : 'hidden');
    }, [open, isControlled, disabled]);

    const isMounted = phase !== 'hidden';

    return (
        <div className={`relative ${className}`}>
            <div
                ref={triggerRef}
                onMouseEnter={isControlled ? undefined : showTooltip}
                onMouseLeave={isControlled ? undefined : hideTooltip}
                onFocus={isControlled ? undefined : showTooltip}
                onBlur={isControlled ? undefined : hideTooltip}
            >
                {children}
            </div>

            {!disabled && isMounted && createPortal(
                <div
                    ref={tooltipRef}
                    className={`
                        absolute z-[9999] pointer-events-none select-none
                        transition duration-150 ease-out
                        ${phase === 'visible' ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
                    `}
                    style={{
                        position: 'fixed',
                        top: `${tooltipPosition.top}px`,
                        left: `${tooltipPosition.left}px`,
                        visibility: phase === 'measuring' ? 'hidden' : 'visible',
                    }}
                >
                    {content}
                </div>,
                document.body
            )}
        </div>
    );
};

export default BaseTooltip;