export const featuredCourses = (courses, date = new Date()) => {
    let seed = [...date.toISOString().slice(0, 10)].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261)
    const shuffled = [...courses].sort((a, b) => a.courseId.localeCompare(b.courseId))
    for (let i = shuffled.length - 1; i > 0; i--) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        const j = seed % (i + 1)
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.slice(0, 3)
}
