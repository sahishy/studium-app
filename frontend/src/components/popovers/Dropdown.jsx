import React from 'react';
import BasePopover from './BasePopover';

const Dropdown = ({ children, options, onSelect, className = '', onOpen, isOptionSelected }) => {

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
                        onClick={() => {
                            if(!option.isDivider) {
                                onSelect(option);
                                closePopover();
                            }
                        }}
                        className={`flex gap-2 items-center justify-start p-2 text-neutral0 text-sm rounded-xl cursor-pointer ${
                            selected ? 'bg-neutral0 text-neutral6' : 'hover:bg-neutral5'
                        }`}
                    >
                        <div className='text-neutral1'>{option.icon}</div>
                        <div className="text-sm truncate">{option.label}</div>
                    </li>
                        )
                    })()
                )
            )}
        </ul>
  );

    return (
        <BasePopover content={dropdownContent} className={className} onOpen={onOpen}>
            {(isOpen) => children(isOpen)}
        </BasePopover>
    );
};

export default Dropdown;