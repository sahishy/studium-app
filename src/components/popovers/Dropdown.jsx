import React from 'react';
import BasePopover from './BasePopover';

const Dropdown = ({ children, options, onSelect, className = '' }) => {

    const dropdownContent = (closePopover) => (
        <ul className="flex flex-col">
            {options.map((option, index) =>
                option.isDivider ? (
                    <hr key={index} className="my-2 border-1 border-gray-200 rounded-full" />
                ) : (
                    <li
                        key={index}
                        onClick={() => {
                            if(!option.isDivider) {
                                onSelect(option);
                                closePopover();
                            }
                        }}
                        className="flex gap-2 items-center justify-start p-2 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-800/5 cursor-pointer"
                    >
                        {option.icon}
                        <div className="text-sm truncate">{option.label}</div>
                    </li>
                )
            )}
        </ul>
  );

    return (
        <BasePopover content={dropdownContent} className={className}>
            {(isOpen) => children(isOpen)}
        </BasePopover>
    );
};

export default Dropdown;