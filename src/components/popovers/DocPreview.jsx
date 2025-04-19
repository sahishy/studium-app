import React from 'react';
import BasePopover from './BasePopover';

const DocPreview = ({ children, doc, className = '' }) => {

    const dropdownContent = (closePopover) => (
        <div>
            <iframe
                src={`https://drive.google.com/file/d/${doc.id}/preview`}
                className={`${doc.type === 'presentation' || doc.type === 'spreadsheet' ? 'min-w-[588px] min-h-[360px]' : 'min-w-[425px] min-h-[550px]'} rounded-lg`}
            />
        </div>
  );

    return (
        <BasePopover content={dropdownContent} className={className}>
            {(isOpen) => children(isOpen)}
        </BasePopover>
    );
};

export default DocPreview;