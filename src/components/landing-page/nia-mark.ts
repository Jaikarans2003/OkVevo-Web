/**
 * Nia mark pose math. Geometry matches the desktop orange bear
 * (hermes-agent/apps/desktop/src/plugins/hermes-bots/avatar.tsx):
 * hair buns, stadium eyes, idle sway, and the working lean.
 * happy / think are website eye reads on that same clock.
 */

export const NIA_MARK_COLOR = '#ff6d1f'
export const EYE_INK = 'rgba(0,0,0,0.85)'

export const BEAR_HEAD_R = 15
export const BEAR_BUN_L = [8.0, 11.0] as const
export const BEAR_BUN_R = [29.8, 11.9] as const
export const BEAR_BUN_L_R = 7.0
export const BEAR_BUN_R_R = 5.8
export const BEAR_EYE_W = 2.9
export const BEAR_EYE_H = 4.25
export const BEAR_EYE_TILT = -16
export const BEAR_SHUT_HALF = 2.25
export const BEAR_ANCHOR = { y: 16.1, l: 15.6, r: 24.4 }

export type NiaMood = 'idle' | 'happy' | 'work' | 'think'
export type EyeRead = 'open' | 'arc'

export interface FacePose {
    blink: boolean
    d0: number
    d1: number
    d2: number
    eye: EyeRead
    gazeX: number
    gazeY: number
    roll: number
    squint: number
    tilt: number
    turn: number
}

type FacePoint = [number, number]

export function moodForProgress(progress: number): NiaMood {
    if (progress < 1 / 3) return 'happy'
    if (progress < 2 / 3) return 'work'
    return 'think'
}

/** Grok-style pose from the desktop face clock, plus happy arcs and a think squint. */
export function facePose(mood: NiaMood, t: number): FacePose {
    if (mood === 'work') {
        return {
            turn: -11 + Math.sin(t * 0.48) * 8,
            tilt: Math.sin(t * 0.42) * 8 + Math.sin(t * 1.1) * 1.6,
            roll: Math.sin(t * 0.75) * 4.2,
            gazeX: Math.sin(t * 0.55) * 3.6,
            gazeY: -1.6 + Math.sin(t * 0.38) * 2,
            blink: t % 1.45 > 1.26,
            eye: 'open',
            squint: 1,
            d0: 0.2 + 0.8 * Math.max(0, Math.sin(t * 2.6)),
            d1: 0.2 + 0.8 * Math.max(0, Math.sin(t * 2.6 - 0.7)),
            d2: 0.2 + 0.8 * Math.max(0, Math.sin(t * 2.6 - 1.4)),
        }
    }

    if (mood === 'happy') {
        return {
            turn: Math.sin(t * 0.7) * 4,
            tilt: 2.5 + Math.sin(t * 0.9) * 2.4,
            roll: Math.sin(t * 1.1) * 3.2,
            gazeX: Math.sin(t * 0.45) * 0.6,
            gazeY: -0.35,
            blink: t % 4.4 > 4.22,
            eye: 'arc',
            squint: 1,
            d0: 0,
            d1: 0,
            d2: 0,
        }
    }

    if (mood === 'think') {
        return {
            turn: -7 + Math.sin(t * 0.22) * 2.4,
            tilt: -4 + Math.sin(t * 0.18) * 1.4,
            roll: -2.4 + Math.sin(t * 0.3),
            gazeX: -1.5 + Math.sin(t * 0.35) * 0.7,
            gazeY: -3.15,
            blink: t % 3.6 > 3.4,
            eye: 'open',
            squint: 0.62,
            d0: 0,
            d1: 0,
            d2: 0,
        }
    }

    return {
        turn: Math.sin(t * 0.5) * 1.5,
        tilt: Math.sin(t * 0.27),
        roll: Math.sin(t * 0.85) * 1.2,
        gazeX: 0,
        gazeY: 0,
        blink: t % 3.2 > 3.02,
        eye: 'open',
        squint: 1,
        d0: 0,
        d1: 0,
        d2: 0,
    }
}

/** Cursor aim on the desktop idle clock. Blink stays `t % 3.2 > 3.02`.
 *  dx/dy are pixels from the face center. */
export function poseToward(dx: number, dy: number, t: number): FacePose {
    const idle = facePose('idle', t)
    const len = Math.hypot(dx, dy) || 1
    const reach = Math.min(1, len / 280)
    return {
        ...idle,
        turn: (dx / len) * 22 * reach,
        tilt: (dy / len) * 12 * reach,
        roll: (dx / len) * 6 * reach,
        gazeX: Math.max(-3.4, Math.min(3.4, dx / 70)),
        gazeY: Math.max(-2.2, Math.min(2.2, dy / 90)),
        eye: 'open',
        squint: 1,
    }
}

export function projectFacePoint(x: number, y: number, turn: number, tilt: number, roll: number): FacePoint {
    const dx = x - 20
    const dy = y - 20
    const r = (roll * Math.PI) / 180
    const xr = dx * Math.cos(r) - dy * Math.sin(r)
    const yr = dx * Math.sin(r) + dy * Math.cos(r)
    const sx = 0.74 + 0.26 * Math.abs(Math.cos((turn * Math.PI) / 180))
    const sy = 0.8 + 0.2 * Math.abs(Math.cos((tilt * Math.PI) / 180))

    return [20 + xr * sx, 20 + yr * sy]
}

export function bearShut(eyeL: number, eyeR: number, eyeY: number) {
    const half = BEAR_SHUT_HALF
    return `M${eyeL - half} ${eyeY} L${eyeL + half} ${eyeY} M${eyeR - half} ${eyeY} L${eyeR + half} ${eyeY}`
}

/** Upward arcs in eye-local space. Happy read, same ink as the stadium eyes. */
export const HAPPY_EYE_D = 'M-1.55 0.62 Q0 -1.15 1.55 0.62'
