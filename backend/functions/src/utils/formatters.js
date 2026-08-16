const asDate = (value) => {
    if(!value) return null
    if(typeof value?.toDate === 'function') return value.toDate()

    const dateValue = new Date(value)
    return Number.isNaN(dateValue.getTime()) ? null : dateValue
}

export {
    asDate,
}
