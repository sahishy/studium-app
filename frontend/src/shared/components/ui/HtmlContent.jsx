const HtmlContent = ({ html, className = '' }) => {

    if(!html) {
        return null
    }

    return (
        <div
            className={`
                text-left
                text-xs
                leading-relaxed
                [&_p]:mb-3
                [&_p:last-child]:mb-0
                [&_ul]:list-disc
                [&_ul]:pl-6 [&_ul]:my-3
                [&_ol]:list-decimal
                [&_ol]:pl-6 [&_ol]:my-3
                [&_li]:mb-1
                [&_li]:marker:text-neutral0
                [&_img]:max-w-full
                [&_img]:h-auto
                [&_img]:rounded-md
                [&_table]:w-full
                [&_table]:border-collapse
                [&_td]:align-top
                [&_td]:p-1 [&_th]:p-1
                [&_math]:inline-block 
                pointer-events-none
                select-none
                ${className}
            `}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    )

}

export default HtmlContent