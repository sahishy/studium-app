// Both measurements are untransformed viewport rectangles, not window dimensions.
export const getCrateOpeningOffset = (anchor, locker) => ({
    x: locker.left + locker.width / 2 - (anchor.left + anchor.width / 2),
    y: locker.top + locker.height / 2 - (anchor.top + anchor.height / 2),
})
