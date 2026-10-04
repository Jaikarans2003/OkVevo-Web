'use client'

import { useLayoutEffect, useRef } from 'react'
import NiaMark from './NiaFace'

const RINGS = [
    ['Plan my week', 'Book Thursday at 4', 'Summarise this PDF'],
    ['Remind me every Monday at 9', 'Draft a reply to this email', 'Find yesterday’s file', 'What’s on my calendar'],
    ['Research this, give me the short version', 'Remember that I prefer…', 'Turn these notes into a list', 'Shorten this paragraph'],
]

const BASE_RADIUS = 128
const ORBIT_GAP = 136
const BASE_DURATION = 36
const FIT = 860

export default function AssistantCircles() {
    const stageRef = useRef<HTMLDivElement>(null)
    const fitRef = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        const stage = stageRef.current
        const fit = fitRef.current
        if (!stage || !fit) return
        const apply = () => {
            const scale = Math.min(1, stage.clientWidth / FIT, stage.clientHeight / FIT)
            fit.style.transform = `scale(${scale})`
        }
        apply()
        const observer = new ResizeObserver(apply)
        observer.observe(stage)
        return () => observer.disconnect()
    }, [])

    return (
        <section className="assistant-split" aria-label="First, she’s a great assistant">
            <div className="assistant-copy">
                <h2 className="nia-display nia-h2">First, she’s a great assistant.</h2>
                <p className="mt-5 max-w-[28rem] text-[1.0625rem] leading-normal">
                    She remembers what you tell her, and gets better the more you work together.
                </p>
            </div>
            <div className="circles-stage" ref={stageRef} aria-label="Everyday tasks">
                <div className="circles-fit" ref={fitRef}>
                {RINGS.map((ring, row) => {
                    const radius = BASE_RADIUS + row * ORBIT_GAP
                    const duration = BASE_DURATION + row * 8
                    const reverse = row % 2 === 1
                    return (
                        <div
                            key={radius}
                            className="circle-ring"
                            style={{
                                width: radius * 2,
                                height: radius * 2,
                                marginLeft: -radius,
                                marginTop: -radius,
                                animationDuration: `${duration}s`,
                                animationDirection: reverse ? 'reverse' : 'normal',
                            }}
                        >
                            <span className="circle-path" />
                            {ring.map((label, index) => {
                                const angle = (360 / ring.length) * index + row * (180 / ring.length)
                                return (
                                    <span
                                        key={label}
                                        className="circle-orb"
                                        style={{ transform: `rotate(${angle}deg) translateY(-${radius}px)` }}
                                    >
                                        <span
                                            className="circle-spin"
                                            style={{
                                                animationDuration: `${duration}s`,
                                                animationDirection: reverse ? 'normal' : 'reverse',
                                            }}
                                        >
                                            <span className="circle-label" style={{ transform: `translate(-50%, -50%) rotate(${-angle}deg)` }}>
                                                {label}
                                            </span>
                                        </span>
                                    </span>
                                )
                            })}
                        </div>
                    )
                })}
                <div className="circles-face">
                    <NiaMark followCursor className="h-full w-full" />
                </div>
                </div>
            </div>
        </section>
    )
}
