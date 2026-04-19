const HtmlContent = ({ html, className = '' }) => {

    if (!html) {
        return null
    }

    const normalizeMathML = (html) => {

        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')

        const mfencedNodes = doc.querySelectorAll('mfenced')

        mfencedNodes.forEach((node) => {
            const open = node.getAttribute('open') || '('
            const close = node.getAttribute('close') || ')'

            const mrow = doc.createElement('mrow')

            const openMo = doc.createElement('mo')
            openMo.textContent = open

            const closeMo = doc.createElement('mo')
            closeMo.textContent = close

            mrow.appendChild(openMo)

            while (node.firstChild) {
                mrow.appendChild(node.firstChild)
            }

            mrow.appendChild(closeMo)

            node.replaceWith(mrow)
        })

        return doc.body.innerHTML
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
                [&_img.math-img]:inline-block
                [&_img.math-img]:align-middle
                [&_img.math-img]:my-0
                [&_table]:w-full
                [&_table]:border-collapse
                [&_td]:align-top
                [&_td]:p-1 [&_th]:p-1
                [&_math]:max-w-full
                [&_math]:overflow-x-auto
                [&_math]:vertical-align-middle
                [&_math[display='block']]:display:block
                [&_math[display='block']]:text-center
                [&_math[display='block']]:my-2
                pointer-events-none
                select-none
                ${className}
            `}
            dangerouslySetInnerHTML={{ __html: normalizeMathML(html) }}
        />
    )

}

export default HtmlContent