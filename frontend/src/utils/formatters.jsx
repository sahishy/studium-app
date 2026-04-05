const DATE_MS = {
    day: 86400000,
    week: 604800000,
    year: 31536000000,
};

const toDateFromSeconds = (seconds) => new Date(seconds * 1000);

const toDateKeyFromSeconds = (seconds) => toDateFromSeconds(seconds).toLocaleDateString();

const formatDateFromSeconds = (seconds) => toDateFromSeconds(seconds).toLocaleDateString();

const toTitleCase = (value = '') => String(value ?? '')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatRelativeTaskDate = (seconds) => {
    const now = Date.now();
    const dateMs = seconds * 1000;
    const today = new Date(now);
    const target = new Date(dateMs);

    const isSameDay = (a, b) => a.toDateString() === b.toDateString();

    if(isSameDay(today, target)) return 'Today';
    if(isSameDay(new Date(now + DATE_MS.day), target)) return 'Tomorrow';
    if(isSameDay(new Date(now - DATE_MS.day), target)) return 'Yesterday';

    const diff = dateMs - now;

    if(diff < 0) {
        return target.toLocaleDateString();
    }

    if(diff < DATE_MS.week) {
        return target.toLocaleDateString('default', { weekday: 'long' });
    }

    if(diff < 2 * DATE_MS.week) {
        const weekday = target.toLocaleDateString('default', { weekday: 'long' });
        return `Next ${weekday}`;
    }

    if(diff < DATE_MS.year) {
        const day = target.getDate();
        let suffix = 'th';
        if(!(day % 100 >= 10 && day % 100 <= 19)) {
            if(day % 10 === 1) suffix = 'st';
            else if(day % 10 === 2) suffix = 'nd';
            else if(day % 10 === 3) suffix = 'rd';
        }

        const monthDay = target.toLocaleDateString('default', { day: 'numeric', month: 'long' });
        return `${monthDay}${suffix}`;
    }

    return target.toLocaleDateString();
}

export {
    toDateFromSeconds,
    toDateKeyFromSeconds,
    formatDateFromSeconds,
    formatRelativeTaskDate,
    toTitleCase,
}