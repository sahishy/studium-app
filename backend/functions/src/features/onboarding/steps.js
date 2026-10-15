const info = (id,route,target,text) => ({id,route,target,text,kind:'info'})
const action = (id,route,target,text,event,destination) => ({id,route,target,text,kind:'action',event,destination})
export const PLAY_STEPS = [
    info('rank','/play','lobby:game-card','Win online games to climb the ranks'),
    info('modes','/play','lobby:modes','Choose from a variety of fun game modes'),
    action('to-progress','/play','nav:/progress','Open Progress','navigate','/progress'),
    info('levels','/progress','progress:levels','Earn XP to level up and unlock rewards'),
    info('quests','/progress','progress:quests','Complete quests to earn XP and Lumen'),
    info('mastery','/progress','progress:mastery','See the skills you’re improving as you play'),
    action('to-locker','/progress','nav:/locker','Open Locker','navigate','/locker/color'),
    info('customize','/locker/color','locker:customize','Customize your avatar with colors, faces, titles, and hats'),
    action('to-crates','/locker/color','locker:crates','Open Crates','navigate','/locker/crates'),
    info('lumen','/locker/crates','locker:crate-shop','Open crates with Lumen to discover new cosmetics'),
    action('to-socials','/locker/crates','nav:/socials','Open Socials','navigate','/socials'),
    info('friends','/socials','socials:friends','Play with friends and join Circles to learn together'),
    action('to-lobby','/socials','nav:/play','Return to Lobby','navigate','/play'),
    action('practice','/play','lobby:play','Let’s try a quick game. Press Play','practice'),
]
export const STUDY_STEPS = [
    action('task-one','/agenda/list','agenda:editor','Type “Finish homework tomorrow” and press Enter','task-one'),
    info('task-date','/agenda/list','agenda:sample-one','Studium recognized “tomorrow” and added a due date.'),
    action('to-board','/agenda/list','agenda:board','Try the Board view','navigate','/agenda/board'),
    info('board','/agenda/board','agenda:content','Studium has different views for organizing your tasks'),
    action('to-calendar','/agenda/board','agenda:calendar','Try the Calendar view','navigate','/agenda/calendar'),
    info('calendar','/agenda/calendar','agenda:content','You can choose the list, board, or calendar view based on your preferences'),
    action('to-courses','/agenda/calendar','nav:/courses','Open Courses','navigate','/courses'),
    info('courses','/courses/me','courses:add','Add your classes here'),
    action('add-apush','/courses/me','courses:add','Let’s try adding AP US History. Search for the course, select it, then choose Add Course','course-added'),
    action('open-apush','/courses/me','course:LCPS-750100','Open AP US History','navigate','/courses/all/LCPS-750100'),
    info('reviews','/courses/all/LCPS-750100','courses:reviews','Read what other students think of a course here'),
    action('back-agenda','/courses/all/LCPS-750100','nav:/agenda','Return to Agenda','navigate','/agenda/list'),
    action('task-two','/agenda/list','agenda:editor','Type “apush test in 2 days” and press Enter','task-two'),
    info('course-recognition','/agenda/list','agenda:sample-two','Studium recognized your class and the due date'),
    action('delete-task','/agenda/list','agenda:sample-two','To delete a task, delete the text and press Backspace when empty','task-deleted'),
    action('to-resources','/agenda/list','nav:/resources','Open Resources','navigate','/resources'),
    info('resources','/resources','resources:content','Students can make and share their own lessons and study materials here'),
]
const baseStepsFor = (path,run) => {
    // Version 2 included a Lobby introduction. Preserve its saved step indices;
    // new runs and original version 1 runs begin with ranked play.
    const play=run.id && run.stepsVersion===2 ? [info('lobby','/play','main:screen','This is the Lobby. Online matches and private games with friends take place here.'),...PLAY_STEPS] : PLAY_STEPS
    return path === 'play' ? play : path === 'study' ? STUDY_STEPS : [...play,info('transition','/play','lobby:play','Nice work! Let’s try Study next.'),...STUDY_STEPS]
}
export const rewardFor = (path, rewarded = []) => (path === 'both' ? ['play','study'] : [path]).filter(t => !rewarded.includes(t))
export const ONLINE_EVENTS = [{id:'onboarding:v1',type:'onboarding',order:0}]

// Keep the crate step in place for stable progress across refreshes.
export const stepsFor = (path, run = {}) => baseStepsFor(path,run).map(step => step.id === 'lumen' && run.freeCrateIncluded ? {...step,kind:'action',event:'tutorial-crate',text:'Use lumen to open crates for cosmetics. Open your first one for free!'} : step)
