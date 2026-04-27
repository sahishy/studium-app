import { doc, updateDoc } from 'firebase/firestore'
import confetti from 'canvas-confetti';
import { db } from '../../../lib/firebase';
import { getXpToNextLevel } from '../utils/xpUtils';

const updateUserXP = async (profile, value) => {

    const docRef = doc(db, 'users', profile.uid)
    const currentXP = profile?.progress?.xp ?? profile?.xp ?? 0
    const currentLevel = profile?.progress?.level ?? profile?.level ?? 1

    await updateDoc(docRef, {
        'progress.xp': currentXP + value
    })

    if(currentXP + value >= getXpToNextLevel(currentLevel)) {
        await userLevelUp({ profile })
    }

}

const userLevelUp = async ({ profile }) => {

    levelUpAnimation(false);

    const docRef = doc(db, 'users', profile.uid)
    const currentLevel = profile?.progress?.level ?? profile?.level ?? 1

    await updateDoc(docRef, {
        'progress.level': currentLevel + 1,
        'progress.xp': 0
    })

}

const updateCircleXP = async (circle, value) => {

    const docRef = doc(db, 'circles', circle.uid)

    await updateDoc(docRef, {
        xp: circle.xp + value
    })

    if(circle.xp + value >= getXpToNextLevel(currentLevel)) {
        await circleLevelUp({ circle })
    }

}

const circleLevelUp = async ({ circle }) => {

    levelUpAnimation(true);

    const docRef = doc(db, 'circles', circle.uid)

    await updateDoc(docRef, {
        level: circle.level + 1,
        xp: 0
    })

}

const levelUpAnimation = (isCircle) => {

    var duration = 3000;
    var animationEnd = Date.now() + duration;
    var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0, colors: (isCircle ? ['#38bdf8'] : ['#facc15']) };

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    var interval = setInterval(function() {
        var timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        var particleCount = 50 * (timeLeft / duration);

        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

}

export { updateUserXP, updateCircleXP }