import HtmlContent from "../../../../../shared/components/ui/HtmlContent"

const ChoiceButton = ({ choice, isSelected, isDisabled, onSelect }) => {

    return (
        <button
            type='button'
            onClick={() => onSelect(choice.id)}
            disabled={isDisabled}
            className={`flex items-start gap-3 rounded-xl px-3 py-2 border cursor-pointer transition
                not-disabled:hover:bg-neutral5 disabled:opacity-50 disabled:cursor-not-allowed
                dark:border-neutral4 dark:bg-neutral5
                ${isSelected ? 'border-sat0 ring-1 ring-sat0' : 'border-neutral0'}`}
        >
            <div
                className={`text-xs aspect-square rounded-full border border-neutral0 
                    dark:border-neutral3
                    px-2 flex justify-center items-center select-none
                    ${isSelected ? 'bg-sat0 text-white border-sat0' : ''}`}
            >
                {choice.id}
            </div>

            <div className='text-left self-center'>
                <HtmlContent html={choice.label} className='[&_p]:mb-2' />
            </div>
        </button>
    )

}

export default ChoiceButton