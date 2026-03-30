import { Editor, Element as SlateElement, Transforms } from 'slate'
import { FaCheck } from 'react-icons/fa6'

const ListTask = ({ attributes, children, element, editor }) => {
    const isCompleted = element.status === 'Completed'

    return (
        <div {...attributes} className={`group flex items-center gap-2 text-sm ${isCompleted ? 'text-text2' : 'text-text1'}`}>
            <span contentEditable={false} suppressContentEditableWarning>
                <button
                    type='button'
                    onMouseDown={(e) => {
                        e.preventDefault()
                        const entry = Editor.nodes(editor, {
                            at: [],
                            match: (n) => SlateElement.isElement(n) && n.taskId === element.taskId,
                        }).next().value

                        if(!entry) return

                        const [, path] = entry
                        Transforms.setNodes(
                            editor,
                            { status: isCompleted ? 'Incomplete' : 'Completed' },
                            { at: path }
                        )
                    }}
                    className={`group/check shrink-0 flex h-4 w-4 items-center justify-center rounded-[3px] border bg-transparent cursor-pointer transition-all  ${
                        isCompleted
                            ? 'opacity-100 border-neutral2'
                            : 'opacity-0 border-transparent group-hover:opacity-100 group-hover:border-neutral2 hover:border-neutral3'
                    }`}
                >
                    <FaCheck
                        className={`text-[10px] ${
                            isCompleted
                                ? 'opacity-100 text-neutral0'
                                : 'opacity-0 text-neutral2 group-hover/check:opacity-100'
                        }`}
                    />
                </button>
            </span>

            <div className={`w-full ${isCompleted ? 'line-through text-neutral1' : 'text-neutral0'}`}>{children}</div>
        </div>
    )
}

export default ListTask