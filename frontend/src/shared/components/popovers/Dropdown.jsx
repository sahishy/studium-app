import React from 'react';
import BasePopover from './BasePopover';

const Dropdown = ({ children, options, onSelect, className = '', onOpen, isOptionSelected, align = 'start' }) => {

    const dropdownContent = (closePopover) => (
        <ul className="flex flex-col">
            {options.map((option, index) =>
                option.isDivider ? (
                    <hr key={index} className="my-2 border-1 border-neutral4 rounded-full" />
                ) : (
                    (() => {
                        const selected = isOptionSelected ? isOptionSelected(option) : false
                        return (
                    <li
                        key={index}
                        aria-disabled={option.disabled || undefined}
                        onClick={() => {
                            if(!option.isDivider && !option.disabled) {
                                onSelect(option);
                                closePopover();
                            }
                        }}
                        className={`flex gap-2 items-center justify-start p-2 text-sm rounded-xl ${
                            option.disabled ? 'text-neutral2 cursor-not-allowed' : `text-neutral0 cursor-pointer ${selected ? 'bg-neutral4 text-neutral0' : 'hover:bg-neutral5'}`
                        }`}
                    >
                        <div className={option.disabled ? 'text-neutral2' : 'text-neutral1'}>{option.icon}</div>
                        <div className="text-sm truncate">{option.label}</div>
                        {option.badge ? <span className='ml-auto text-[10px] font-medium text-neutral2'>{option.badge}</span> : null}
                    </li>
                        )
                    })()
                )
            )}
        </ul>
  );

    return (
        <BasePopover content={dropdownContent} className={className} onOpen={onOpen} align={align}>
            {(isOpen) => children(isOpen)}
        </BasePopover>
    );
};

export default Dropdown;
