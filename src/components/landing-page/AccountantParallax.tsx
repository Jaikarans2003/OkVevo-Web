'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import NiaChatFrame, { type ChatTurn } from './NiaChatFrame'
import NiaMark from './NiaFace'
import {
    CARD,
    FILES,
    JUNCTION,
    MASCOT,
    PILL_IN,
    PILL_OUT,
    RESULT_X,
    SPINE,
    STAGE,
    WORD_W,
    feedPath,
    resultBox,
    shuffleIds,
    streamPath,
    type DumpFile,
} from './dump-wave'

const STEP = 640
const HOLD = 1200
const ASK = 700
const FIRST_ASK = 1600
const THINK = 450
const BEAT = 1100
const CHUNK = 4
const TICK = 24
const WORD = 'Result'

function place(node: { x: number; y: number; w: number; h: number }): CSSProperties {
    return { left: node.x, top: node.y, width: node.w, height: node.h }
}

function FileGlyph({ hot }: { hot: boolean }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden className="h-[38%] w-auto max-h-7">
            <path
                d="M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5z"
                fill={hot ? '#FF6F20' : '#2A2A2A'}
                opacity={hot ? 1 : 0.78}
            />
            <path d="M14 3.6V8h4.2" fill="none" stroke={hot ? '#fff' : '#C8CDD6'} strokeWidth="1.4" />
        </svg>
    )
}

function FileCard({ file, on }: { file: DumpFile; on: boolean }) {
    return (
        <div className={`dump-file${on ? ' is-on' : ''}`}>
            <FileGlyph hot={on} />
            <p className="dump-file-kind">{file.kind}</p>
            <p className="dump-file-name">{file.name}</p>
        </div>
    )
}

function ResultWord({ phase }: { phase: 'in' | 'out' | 'still' }) {
    return (
        <p className={`dump-word nia-display${phase === 'still' ? '' : ` is-${phase}`}`}>
            {WORD.split('').map((letter, index) => (
                <span key={letter + index} style={{ animationDelay: `${index * 0.045}s` }}>
                    {letter}
                </span>
            ))}
        </p>
    )
}

export default function AccountantParallax() {
    const [lit, setLit] = useState<number[]>([])
    const [featured, setFeatured] = useState<number | null>(null)
    const [turns, setTurns] = useState<ChatTurn[]>([])
    const [shown, setShown] = useState<'word' | 'card'>('word')
    const [swap, setSwap] = useState<'idle' | 'word-out' | 'card-in'>('idle')
    const [motionOk, setMotionOk] = useState(false)
    const sectionRef = useRef<HTMLElement>(null)
    const centerRef = useRef<HTMLDivElement>(null)
    const fitRef = useRef<HTMLDivElement>(null)
    const [wordWidth, setWordWidth] = useState(WORD_W)
    const hot = new Set(lit)
    const cardBox = resultBox(FILES.length)
    const slotWidth = shown === 'card' ? cardBox.w : wordWidth
    const fitWidth = RESULT_X + slotWidth

    // One pass: light a file, ask, stream the reply, and only then move to the next file.
    // The chat keeps every turn; only the file highlights unwind at the end.
    useEffect(() => {
        const all = FILES.map((_, index) => index)
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setLit(all)
            setTurns(all.map((index) => ({ index })))
            return
        }

        setMotionOk(true)
        setLit([])
        setFeatured(null)
        setTurns([])
        setShown('word')
        setSwap('idle')

        let onscreen = false
        const timers = new Set<number>()
        const nap = (ms: number) =>
            new Promise<void>((resolve) => {
                const id = window.setTimeout(() => {
                    timers.delete(id)
                    resolve()
                }, ms)
                timers.add(id)
            })
        const visible = async () => {
            while (!onscreen) await nap(250)
        }
        // Visible = touching the middle band of the viewport, so tall stacked layouts on phones still qualify.
        const watcher = new IntersectionObserver(([entry]) => (onscreen = entry.isIntersecting), { rootMargin: '-25% 0px' })
        if (sectionRef.current) watcher.observe(sectionRef.current)

        const play = async () => {
            const order = shuffleIds(all)
            await nap(360)
            for (const [step, index] of order.entries()) {
                await visible()
                setLit(order.slice(0, step + 1))
                setFeatured(index)
                await nap(step === 0 ? FIRST_ASK : ASK)
                setTurns((prev) => [...prev, { index, chars: 0 }])
                await nap(THINK)
                const reply = FILES[index].result
                for (let chars = CHUNK; chars < reply.length + CHUNK; chars += CHUNK) {
                    await visible()
                    setTurns((prev) => prev.map((turn) => (turn.index === index ? { index, chars } : turn)))
                    await nap(TICK)
                }
                setTurns((prev) => prev.map((turn) => (turn.index === index ? { index } : turn)))
                setFeatured(null)
                await nap(BEAT)
            }
            await nap(HOLD)
            for (let step = order.length - 1; step >= 0; step--) {
                setLit(order.slice(0, step))
                await nap(STEP)
            }
        }
        void play()

        return () => {
            watcher.disconnect()
            timers.forEach((id) => window.clearTimeout(id))
        }
    }, [])

    // “Result” flips to the chat once, when the first file lights. It never flips back.
    useEffect(() => {
        if (lit.length === 0 || shown !== 'word') return
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setShown('card')
        if (swap === 'idle') setSwap('word-out')
    }, [lit.length, shown, swap])

    useEffect(() => {
        if (swap === 'idle') return
        const id = window.setTimeout(() => {
            if (swap === 'word-out') {
                setShown('card')
                setSwap('card-in')
            } else {
                setSwap('idle')
            }
        }, swap === 'word-out' ? 820 : 560)
        return () => window.clearTimeout(id)
    }, [swap])

    useLayoutEffect(() => {
        const center = centerRef.current
        const fit = fitRef.current
        if (!center || !fit) return
        const apply = () => {
            const word = fit.querySelector('.dump-word')
            if (word) {
                const next = Math.ceil(word.scrollWidth)
                if (next > wordWidth) setWordWidth(next)
            }
            const available = center.clientWidth
            const scale = available > 0 ? Math.min(1, available / fitWidth) : 1
            fit.style.transform = `scale(${scale})`
            center.style.height = `${STAGE.h * scale}px`
        }
        apply()
        const observer = new ResizeObserver(apply)
        observer.observe(center)
        return () => observer.disconnect()
    }, [fitWidth, wordWidth])

    const wordPhase = swap === 'word-out' ? 'out' : 'still'
    const cardPhase = swap === 'card-in' ? 'in' : 'still'
    const done = turns.filter((turn) => turn.chars === undefined).at(-1)
    const spoken = done
        ? `${FILES[done.index].prompt} ${FILES[done.index].name}. ${FILES[done.index].result.replace(/[*_]/g, '')} ${FILES[done.index].output}`
        : shown === 'word'
          ? WORD
          : ''

    return (
        <section ref={sectionRef} className="accountant-parallax bg-[var(--bg)]" aria-label="Then, she’s an accountant">
            <p className="text-[0.75rem] font-medium tracking-[0.06em] text-[var(--muted)] uppercase">Her profession</p>
            <h2 className="nia-display nia-h2 mx-auto mt-3 max-w-[14em]">Then, she’s an accountant.</h2>
            <p className="mx-auto mt-3 max-w-[34rem] text-[1.0625rem] leading-normal">
                The grunt work your firm does every month — done before you open the file.
            </p>

            <div ref={centerRef} className="dump-center">
                <div ref={fitRef} className="dump-fit" style={{ width: fitWidth, height: STAGE.h }}>
                    <svg
                        className="dump-svg"
                        viewBox={`0 0 ${RESULT_X} ${STAGE.h}`}
                        width={RESULT_X}
                        height={STAGE.h}
                        aria-hidden
                    >
                        {FILES.map((file) => (
                            <path key={file.id} className="dump-line" d={feedPath(file)} />
                        ))}
                        {FILES.map((file, index) =>
                            hot.has(index) ? <path key={`${file.id}-hot`} className="dump-line is-hot" d={feedPath(file)} /> : null,
                        )}
                        {SPINE.map((d) => (
                            <path key={d} className={`dump-line${hot.size ? ' is-hot' : ''}`} d={d} />
                        ))}
                        {motionOk && featured != null ? (
                            <circle key={FILES[featured].id} r="5" fill="#FF6F20">
                                <animateMotion dur="1.35s" repeatCount="indefinite" path={streamPath(FILES[featured])} />
                            </circle>
                        ) : null}
                        <rect className="dump-pill" x={PILL_IN.x} y={PILL_IN.y} width={PILL_IN.w} height={PILL_IN.h} rx={PILL_IN.h / 2} />
                        <rect className="dump-pill" x={PILL_OUT.x} y={PILL_OUT.y} width={PILL_OUT.w} height={PILL_OUT.h} rx={PILL_OUT.h / 2} />
                    </svg>

                    {FILES.map((file, index) => (
                        <div key={file.id} className="dump-node" style={{ ...place({ ...file, ...CARD }), zIndex: hot.has(index) ? 3 : 2 }}>
                            <FileCard file={file} on={hot.has(index)} />
                        </div>
                    ))}

                    <div className="dump-node dump-mascot" style={place(MASCOT)}>
                        <NiaMark followCursor className="h-full w-full" />
                    </div>

                    <div
                        className="dump-result-slot"
                        style={{
                            left: RESULT_X,
                            top: shown === 'card' ? cardBox.y : JUNCTION.y - 40,
                            width: slotWidth,
                            height: shown === 'card' ? cardBox.h : undefined,
                        }}
                    >
                        {shown === 'word' ? (
                            <ResultWord phase={wordPhase} />
                        ) : (
                            <NiaChatFrame turns={turns} phase={cardPhase} />
                        )}
                    </div>
                </div>
            </div>

            <div className="dump-stack">
                <ul className="dump-stack-files">
                    {FILES.map((file, index) => (
                        <li key={file.id}>
                            <FileCard file={file} on={hot.has(index)} />
                        </li>
                    ))}
                </ul>
                <div className={`dump-vlink${hot.size ? ' is-hot' : ''}`} />
                <div className="dump-stack-face">
                    <NiaMark followCursor className="h-full w-full" />
                </div>
                <div className={`dump-vlink${hot.size ? ' is-hot' : ''}`} />
                {shown === 'word' ? (
                    <ResultWord phase={wordPhase} />
                ) : (
                    <div className="dump-result-slot" style={{ width: '100%' }}>
                        <NiaChatFrame turns={turns} phase={cardPhase} />
                    </div>
                )}
            </div>

            <p className="sr-only" aria-live="polite">
                {spoken}
            </p>
        </section>
    )
}
