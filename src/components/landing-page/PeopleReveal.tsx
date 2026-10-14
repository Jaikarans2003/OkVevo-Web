'use client'

import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import NiaMark from './NiaFace'
import { holdLandingScroll, scrollLandingTo } from './SmoothScroll'

gsap.registerPlugin(ScrollTrigger)

const PEOPLE = [
    { name: 'Ananya', role: 'Architect', detail: 'Designs homes in Pune', note: '12 years in practice' },
    { name: 'Rahul', role: 'Doctor', detail: 'Runs a clinic in Jaipur', note: 'OPD every morning' },
    { name: 'Meera', role: 'Teacher', detail: 'Class 8, Bengaluru', note: 'Knows every parent' },
    { name: 'Arjun', role: 'Chef', detail: 'Opens the kitchen at 6', note: 'One menu, every day' },
    { name: 'Leela', role: 'Lawyer', detail: 'Chambers in Delhi', note: 'Hearings on Tuesdays' },
    { name: 'You', role: 'Your profession', detail: 'The work people know you for', note: 'One reputation' },
    { name: 'Nia', role: 'Accounts', detail: 'The monthly close, every client', note: 'Known for the books' },
]

const COLUMNS = 3

function columnsOf<T>(items: T[], count: number) {
    const cols: T[][] = Array.from({ length: count }, () => [])
    items.forEach((item, index) => cols[index % count].push(item))
    return cols
}

export default function PeopleReveal() {
    const rootRef = useRef<HTMLElement>(null)
    const columns = columnsOf(PEOPLE, COLUMNS)

    useLayoutEffect(() => {
        const root = rootRef.current
        const face = root?.querySelector<HTMLElement>('.fall-face')
        const land = root?.querySelector<HTMLElement>('.people-aside-face')
        const hero = document.querySelector<HTMLElement>('.hero-face')
        if (!root || !face || !land || !hero) return
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

        const clamp = (value: number) => Math.min(1, Math.max(0, value))
        const wide = window.matchMedia('(min-width: 801px)').matches
        const assistant = document.querySelector<HTMLElement>('.assistant-split')
        if (!assistant) return
        document.documentElement.dataset.bear = 'fall'
        document.querySelector('.bear-runway')?.remove()
        document.querySelector('.assistant-hold')?.remove()

        let phase: 'grow' | 'fade' | 'settle' | 'done' = 'grow'
        let fadeT = 0
        let fadeRaf = 0
        let quiet = 0
        let assistantDocTop = 0
        let sync = () => {}
        let trigger: ScrollTrigger | null = null

        const orangeY = () => {
            const top = root.getBoundingClientRect().top + window.scrollY
            return top + root.offsetHeight - window.innerHeight
        }

        const unpark = () => {
            assistant.style.position = ''
            assistant.style.top = ''
            assistant.style.left = ''
            assistant.style.width = ''
            assistant.style.margin = ''
            assistant.style.zIndex = ''
            delete assistant.dataset.parked
            document.querySelector('.assistant-hold')?.remove()
        }

        const park = () => {
            if (assistant.dataset.parked) return
            assistantDocTop = assistant.getBoundingClientRect().top + window.scrollY
            const hold = document.createElement('div')
            hold.className = 'assistant-hold'
            hold.setAttribute('aria-hidden', 'true')
            hold.style.height = `${assistant.offsetHeight}px`
            hold.style.overflowAnchor = 'none'
            assistant.before(hold)
            assistant.dataset.parked = '1'
            assistant.style.position = 'fixed'
            assistant.style.top = '0'
            assistant.style.left = '0'
            assistant.style.width = '100%'
            assistant.style.margin = '0'
            assistant.style.zIndex = '1'
        }

        const armSettle = () => {
            window.clearTimeout(quiet)
            quiet = window.setTimeout(() => {
                if (phase !== 'settle') return
                phase = 'done'
                holdLandingScroll(false)
            }, 180)
        }

        const finishFade = () => {
            const mark = assistant.querySelector('h2')
            const locked = mark?.getBoundingClientRect().top ?? 0
            phase = 'settle'
            fadeT = 1
            const rootStyle = document.documentElement.style
            const previousAnchor = rootStyle.overflowAnchor
            rootStyle.overflowAnchor = 'none'
            document.body.style.overflowAnchor = 'none'
            unpark()
            const place = () => {
                scrollLandingTo(assistantDocTop)
                const drift = (mark?.getBoundingClientRect().top ?? 0) - locked
                if (Math.abs(drift) > 0.5) scrollLandingTo(window.scrollY + drift)
            }
            place()
            requestAnimationFrame(() => {
                place()
                requestAnimationFrame(() => {
                    rootStyle.overflowAnchor = previousAnchor
                    document.body.style.overflowAnchor = ''
                })
            })
            sync()
            armSettle()
        }

        const startFade = () => {
            if (phase === 'fade' || phase === 'settle' || phase === 'done') return
            phase = 'fade'
            holdLandingScroll(true)
            scrollLandingTo(window.scrollY)
            park()
            const started = performance.now()
            const step = (now: number) => {
                fadeT = clamp((now - started) / 180)
                sync()
                if (fadeT < 1) fadeRaf = requestAnimationFrame(step)
                else finishFade()
            }
            fadeRaf = requestAnimationFrame(step)
        }

        const onWheel = (event: WheelEvent) => {
            if (!wide || event.deltaY <= 0) return
            if (phase === 'fade' || phase === 'settle') {
                event.preventDefault()
                armSettle()
                return
            }
            if (phase === 'grow' && window.scrollY >= orangeY() - 2) {
                event.preventDefault()
                startFade()
            }
        }
        window.addEventListener('wheel', onWheel, { passive: false })

        sync = () => {
            const heroBox = hero.getBoundingClientRect()
            const landBox = land.getBoundingClientRect()
            const section = root.getBoundingClientRect()
            const vh = window.innerHeight
            const vw = window.innerWidth
            const sectionTop = section.top + window.scrollY
            const raw = clamp(window.scrollY / Math.max(sectionTop * 0.85, 1))
            const travel = Math.min(raw / 0.8, 1)
            const dip = Math.sin(clamp((raw - 0.8) / 0.2) * Math.PI) * 42
            const pin = clamp(-section.top / Math.max(section.height - vh, 1))
            const toCenter = clamp(pin / 0.46)
            const ease = toCenter * toCenter * (3 - 2 * toCenter)
            const grown = clamp((pin - 0.4) / 0.6)
            const faceW = Math.max(landBox.width, 1)
            const cover = Math.max(vw, vh) / faceW * 1.45
            // Eyes sit near the middle of the mark. This end size pushes them off
            // the screen so the same scroll reads as a solid orange field.
            const full = Math.max(cover, (vh * 0.62) / (0.07 * faceW))
            if (phase !== 'grow' && window.scrollY < orangeY() - 80) {
                phase = 'grow'
                fadeT = 0
                cancelAnimationFrame(fadeRaf)
                holdLandingScroll(false)
                unpark()
            } else if (wide && phase === 'grow' && window.scrollY > orangeY() + 30) {
                scrollLandingTo(orangeY())
                startFade()
            }
            const fade = phase === 'grow' ? 0 : phase === 'fade' ? fadeT : 1
            const grid = root.querySelector<HTMLElement>('.people-reveal-grid')
            if (grid) grid.style.visibility = grown >= 1 || phase !== 'grow' ? 'hidden' : ''
            root.style.backgroundColor = grown >= 1 || phase !== 'grow' ? '#ff6d1f' : ''
            const landX = heroBox.left + (landBox.left - heroBox.left) * travel
            const landY = heroBox.top + (landBox.top - heroBox.top) * travel + (ease > 0 ? 0 : dip)
            const centerX = (vw - landBox.width) / 2
            const centerY = (vh - landBox.height) / 2
            gsap.set(face, {
                x: landX + (centerX - landX) * ease,
                y: landY + (centerY - landY) * ease,
                width: landBox.width,
                height: landBox.height,
                rotation: ease * 360,
                scale: 1 + grown * (full - 1),
                opacity: 1 - fade,
                zIndex: grown > 0.02 || fade > 0 ? 300 : 40,
                transformOrigin: '50% 50%',
            })
        }

        trigger = ScrollTrigger.create({
            trigger: '.nia-story',
            start: 'top top',
            endTrigger: assistant,
            end: 'top top',
            onUpdate: sync,
            onRefresh: sync,
        })
        sync()
        return () => {
            trigger.kill()
            window.removeEventListener('wheel', onWheel)
            cancelAnimationFrame(fadeRaf)
            window.clearTimeout(quiet)
            holdLandingScroll(false)
            unpark()
            delete document.documentElement.dataset.bear
            root.style.backgroundColor = ''
            root.querySelector<HTMLElement>('.people-reveal-grid')?.style.setProperty('visibility', '')
        }
    }, [])

    return (
        <section ref={rootRef} className="people-reveal" aria-label="Nobody is just one thing">
            <div className="people-reveal-grid">
                <div className="tile-stage" aria-label="Professions">
                    <div className="tile-grid">
                        {columns.map((col, colIndex) => (
                            <div className="tile-col" key={colIndex}>
                                {col.map((person) => (
                                    <article key={person.name} className="person-tile">
                                        <p className="text-[0.6875rem] tracking-[0.06em] text-[var(--muted)] uppercase">{person.role}</p>
                                        <p className="mt-1 text-base font-medium">{person.name}</p>
                                        <p className="mt-2 text-sm leading-snug">{person.detail}</p>
                                        <p className="mt-1 text-xs text-[var(--muted)]">{person.note}</p>
                                    </article>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <aside className="people-aside">
                    <h2 className="nia-display nia-h2">
                        Nobody is just one thing. But everybody is known for one thing.
                    </h2>
                    <p className="mt-4 text-[1.0625rem]">Nia is no different.</p>
                    <div className="people-aside-face">
                        <NiaMark followCursor className="h-full w-full" />
                    </div>
                </aside>
            </div>
            <div className="fall-face" aria-hidden>
                <NiaMark followCursor className="h-full w-full" />
            </div>
        </section>
    )
}
