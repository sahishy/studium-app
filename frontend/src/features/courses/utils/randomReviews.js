// Fisher-Yates selects distinct reviews uniformly, without depending on query order.
const selectRandomReviews = (reviews, random = Math.random) => {
    const shuffled = [...reviews]
    for(let index = 0; index < Math.min(3, shuffled.length); index += 1) {
        const other = index + Math.floor(random() * (shuffled.length - index))
        ;[shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]]
    }
    return shuffled.slice(0, 3)
}

export { selectRandomReviews }
