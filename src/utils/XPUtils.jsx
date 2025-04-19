import { doc, getFirestore, updateDoc } from 'firebase/firestore'
import confetti from 'https://cdn.skypack.dev/canvas-confetti';

const updateUserXP = async ( profile , value ) => {

    const db = getFirestore();
    const docRef = doc(db, 'users', profile.uid)

    await updateDoc(docRef, {
        xp: profile.xp + value
    })

    //check if the user has enough XP to level up

    if(profile.xp + value >= Math.pow(2, profile.level) * 100) {
        await userLevelUp({ profile })
    }

}

const userLevelUp = async ( { profile }) => {

    levelUpAnimation(false);

    const db = getFirestore();
    const docRef = doc(db, 'users', profile.uid)

    await updateDoc(docRef, {
        level: profile.level + 1,
        xp: 0
    })

}

const updateCircleXP = async ( circle , value ) => {

    const db = getFirestore();
    const docRef = doc(db, 'circles', circle.uid)

    await updateDoc(docRef, {
        xp: circle.xp + value
    })

    //check if the circle has enough XP to level up

    if(circle.xp + value >= Math.pow(2, circle.level) * 100) {
        await circleLevelUp({ circle })
    }

}

const circleLevelUp = async ( { circle }) => {

    levelUpAnimation(true);

    const db = getFirestore();
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