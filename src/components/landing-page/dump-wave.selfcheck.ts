import {
    CARD,
    FILES,
    JUNCTION,
    MASCOT,
    PILL_IN,
    PILL_OUT,
    RAIL,
    RESULT_X,
    STAGE,
    feedPath,
    resultBox,
    shuffleIds,
    streamPath,
} from './dump-wave.ts'

if (FILES.length !== 7) throw new Error('seven files in the dump')

for (const file of FILES) {
    const right = file.x + CARD.w
    const midY = file.y + CARD.h / 2
    if (file.x < 0 || file.y < 0 || file.y + CARD.h > STAGE.h) throw new Error(`${file.id} off the stage`)
    if (!file.prompt || !file.output) throw new Error(`${file.id} needs a prompt and an output file`)
    if (file.prompt.length < 80 || file.result.length < 180) throw new Error(`${file.id} prompt and reply should read like a real exchange`)
    if (right >= RAIL) throw new Error(`${file.id} crosses the rail`)
    const path = feedPath(file)
    if (!path.startsWith(`M ${right} ${midY} H ${RAIL}`)) throw new Error(`${file.id} must leave its right edge`)
    if (!path.endsWith(`${JUNCTION.x} ${JUNCTION.y}`)) throw new Error(`${file.id} must arrive at the junction`)
    if (!streamPath(file).endsWith(`H ${RESULT_X}`)) throw new Error(`${file.id} stream must reach the result`)
}

if (RAIL >= JUNCTION.x) throw new Error('rail must sit left of the junction')
if (PILL_IN.x + PILL_IN.w > MASCOT.x) throw new Error('in-pill overlaps the mascot')
if (MASCOT.x + MASCOT.w > PILL_OUT.x) throw new Error('mascot overlaps the out-pill')
if (PILL_OUT.x + PILL_OUT.w > RESULT_X) throw new Error('out-pill overlaps the result')

const sizes = [1, 2, 3, 4, 5, 6, 7].map((count) => resultBox(count))
for (let i = 1; i < sizes.length; i++) {
    if (sizes[i].w !== sizes[0].w) throw new Error('app window width stays fixed')
    if (sizes[i].h !== sizes[0].h) throw new Error('app window stays one size so the thread can scroll')
    if (sizes[i].x !== RESULT_X) throw new Error('result card stays on the right')
    const mid = sizes[i].y + sizes[i].h / 2
    if (Math.abs(mid - JUNCTION.y) > 1) throw new Error('result card stays on the spine')
}
const full = sizes[6]
if (full.x + full.w > STAGE.w || full.y < 0 || full.y + full.h > STAGE.h) throw new Error('full result card leaves the stage')

const faceY = MASCOT.y + (20 / 44) * MASCOT.h
if (Math.abs(faceY - JUNCTION.y) > 2) throw new Error('mascot face should sit on the spine')

let seed = 7
const random = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
}
const shuffled = shuffleIds([0, 1, 2, 3, 4, 5], random)
if (shuffled.length !== 6 || new Set(shuffled).size !== 6) throw new Error('shuffle must be a permutation')
if (shuffled.join() === '0,1,2,3,4,5') throw new Error('this seed should not stay sequential')

console.log('dump-wave.selfcheck ok')
