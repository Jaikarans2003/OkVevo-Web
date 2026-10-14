import { facePose, moodForProgress, poseToward, projectFacePoint } from './nia-mark.ts'

const happy = facePose('happy', 0.2)
const work = facePose('work', 0.5)
const think = facePose('think', 0.4)
const idle = facePose('idle', 0)
const center = projectFacePoint(20, 20, 0, 0, 0)

if (happy.eye !== 'arc' || happy.gazeY >= 0) throw new Error('happy eyes should arc and look up')
if (work.d0 + work.d1 + work.d2 < 0.6) throw new Error('working pose should light the dots')
if (think.eye !== 'open' || think.squint >= 0.8 || think.gazeY > -2) throw new Error('think should squint upward')
if (idle.blink || idle.eye !== 'open') throw new Error('idle at t=0 is open and not blinking')
if (Math.hypot(center[0] - 20, center[1] - 20) > 0.01) throw new Error('face center should stay put')
if (moodForProgress(0) !== 'happy' || moodForProgress(0.5) !== 'work' || moodForProgress(0.9) !== 'think') {
    throw new Error('scroll progress should map happy → work → think')
}
const right = poseToward(180, 0, 0)
if (right.turn <= 4 || right.gazeX <= 0 || right.blink) throw new Error('cursor on the right should turn the head')
if (!poseToward(0, 0, 3.1).blink) throw new Error('blink stays on the desktop idle clock')

console.log('nia-mark.selfcheck ok')
