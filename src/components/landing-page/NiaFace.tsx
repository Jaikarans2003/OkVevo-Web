'use client'

import { useEffect, useRef, type RefObject } from 'react'
import {
    BEAR_ANCHOR,
    BEAR_BUN_L,
    BEAR_BUN_L_R,
    BEAR_BUN_R,
    BEAR_BUN_R_R,
    BEAR_EYE_H,
    BEAR_EYE_TILT,
    BEAR_EYE_W,
    BEAR_HEAD_R,
    EYE_INK,
    HAPPY_EYE_D,
    NIA_MARK_COLOR,
    bearShut,
    facePose,
    poseToward,
    projectFacePoint,
    type FacePose,
    type NiaMood,
} from './nia-mark'

function paintBear(svg: SVGSVGElement, pose: FacePose) {
    const placeBun = (id: string, rest: readonly [number, number]) => {
        const node = svg.querySelector(`[data-hb-ear="${id}"]`)
        if (!node) return
        const [x, y] = projectFacePoint(rest[0], rest[1], pose.turn, pose.tilt, pose.roll)
        node.setAttribute('cx', String(x))
        node.setAttribute('cy', String(y))
    }

    placeBun('l', BEAR_BUN_L)
    placeBun('r', BEAR_BUN_R)

    const eyeY = BEAR_ANCHOR.y + pose.gazeY
    const eyeL = BEAR_ANCHOR.l + pose.gazeX
    const eyeR = BEAR_ANCHOR.r + pose.gazeX
    const showArc = pose.eye === 'arc' && !pose.blink
    const showOpen = pose.eye === 'open' && !pose.blink

    const placeEye = (id: string, x: number) => {
        const node = svg.querySelector(`[data-hb-eye="${id}"]`)
        if (!node) return
        node.setAttribute('transform', `translate(${x} ${eyeY}) rotate(${BEAR_EYE_TILT}) scale(1 ${pose.squint})`)
        node.querySelector('[data-hb-stadium]')?.setAttribute('opacity', showOpen ? '1' : '0')
        node.querySelector('[data-hb-happy]')?.setAttribute('opacity', showArc ? '1' : '0')
    }

    placeEye('l', eyeL)
    placeEye('r', eyeR)

    const shut = svg.querySelector('[data-hb-shut]')
    if (shut) {
        shut.setAttribute('d', bearShut(eyeL, eyeR, eyeY))
        shut.setAttribute('opacity', pose.blink ? '1' : '0')
    }

    const dots = svg.querySelectorAll('[data-hb-dot]')
    const levels = [pose.d0, pose.d1, pose.d2]
    dots.forEach((dot, i) => {
        dot.setAttribute('opacity', String(levels[i] ?? 0))
    })

    const head = svg.querySelector('[data-hb-body]')
    if (head) {
        const sx = 0.78 + 0.22 * Math.abs(Math.cos((pose.turn * Math.PI) / 180))
        const shift = pose.turn * 0.045
        head.setAttribute('transform', `translate(${20 + shift} 20) scale(${sx} 1) translate(-20 -20)`)
    }

    svg.style.transform = `rotate(${pose.tilt}deg)`
    svg.style.transformOrigin = '50% 70%'
}

export default function NiaMark({
    mood = 'idle',
    moodRef,
    followCursor = false,
    className = '',
}: {
    mood?: NiaMood
    /** Scroll scrub writes this. The face clock reads it without a re-render. */
    moodRef?: RefObject<NiaMood>
    /** Eyes, blink, and head turn follow the pointer. Blink stays on the desktop clock. */
    followCursor?: boolean
    className?: string
}) {
    const svgRef = useRef<SVGSVGElement>(null)
    const localMood = useRef(mood)
    if (!moodRef) localMood.current = mood
    const source = moodRef ?? localMood

    useEffect(() => {
        const svg = svgRef.current
        if (!svg) return

        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        let raf = 0
        const start = performance.now()
        const aim = { x: 0, y: 0 }
        const smooth = { x: 0, y: 0 }

        const onMove = (event: PointerEvent) => {
            const box = svg.getBoundingClientRect()
            aim.x = event.clientX - (box.left + box.width / 2)
            aim.y = event.clientY - (box.top + box.height / 2)
        }

        if (followCursor && !reduce) {
            window.addEventListener('pointermove', onMove, { passive: true })
        }

        const frame = (now: number) => {
            const t = reduce ? 0.4 : (now - start) / 1000
            if (followCursor && !reduce) {
                smooth.x += (aim.x - smooth.x) * 0.16
                smooth.y += (aim.y - smooth.y) * 0.16
                paintBear(svg, poseToward(smooth.x, smooth.y, t))
            } else {
                paintBear(svg, facePose(source.current, t))
            }
            if (!reduce) raf = window.requestAnimationFrame(frame)
        }

        raf = window.requestAnimationFrame(frame)
        return () => {
            window.removeEventListener('pointermove', onMove)
            window.cancelAnimationFrame(raf)
        }
    }, [followCursor, source])

    const smile = (moodRef?.current ?? mood) === 'happy'
    const eye = (id: 'l' | 'r', x: number) => (
        <g data-hb-eye={id} transform={`translate(${x} ${BEAR_ANCHOR.y}) rotate(${BEAR_EYE_TILT})`}>
            <rect
                data-hb-stadium="1"
                fill={EYE_INK}
                height={BEAR_EYE_H}
                opacity={smile ? 0 : 1}
                rx={BEAR_EYE_W / 2}
                width={BEAR_EYE_W}
                x={-BEAR_EYE_W / 2}
                y={-BEAR_EYE_H / 2}
            />
            <path
                d={HAPPY_EYE_D}
                data-hb-happy="1"
                fill="none"
                opacity={smile ? 1 : 0}
                stroke={EYE_INK}
                strokeLinecap="round"
                strokeWidth={1.55}
            />
        </g>
    )

    return (
        <svg
            ref={svgRef}
            aria-hidden
            className={`block overflow-visible ${className}`}
            viewBox="0 0 40 44"
        >
            <circle cx={BEAR_BUN_L[0]} cy={BEAR_BUN_L[1]} data-hb-ear="l" fill={NIA_MARK_COLOR} r={BEAR_BUN_L_R} />
            <circle cx={BEAR_BUN_R[0]} cy={BEAR_BUN_R[1]} data-hb-ear="r" fill={NIA_MARK_COLOR} r={BEAR_BUN_R_R} />
            <circle cx={20} cy={20} data-hb-body="1" fill={NIA_MARK_COLOR} r={BEAR_HEAD_R} />
            {eye('l', BEAR_ANCHOR.l)}
            {eye('r', BEAR_ANCHOR.r)}
            <path
                d={bearShut(BEAR_ANCHOR.l, BEAR_ANCHOR.r, BEAR_ANCHOR.y)}
                data-hb-shut="1"
                fill="none"
                opacity={0}
                stroke={EYE_INK}
                strokeLinecap="round"
                strokeWidth={1.65}
            />
            <circle cx={16.4} cy={41.2} data-hb-dot="1" fill={NIA_MARK_COLOR} opacity={0} r={1.15} />
            <circle cx={20} cy={41.2} data-hb-dot="1" fill={NIA_MARK_COLOR} opacity={0} r={1.15} />
            <circle cx={23.6} cy={41.2} data-hb-dot="1" fill={NIA_MARK_COLOR} opacity={0} r={1.15} />
        </svg>
    )
}
