'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import NiaMark from '../NiaFace'
import { Codicon, FOLLOW_UP_PLACEHOLDERS, NiaComposer, NiaTurn, PLACEHOLDERS, Thread, useTypewriter } from './kit'

type Turn = { id: number; user: string; files: string[]; reply: string }
type Section = 'now' | 'yesterday' | 'week' | 'telegram' | 'cron'
type Session = { id: string; title: string; age: string; section: Section; turns: Turn[]; fresh?: boolean }

const DESIGN_H = 600
const HI = "Hi, I'm Nia."
const SUBTITLE = 'Ask a question, paste an error, or point me at a repo. I can read code, run tools, and help you ship.'
const NOTE = 'Nia is AI Agent and can make mistakes, please double-check responses'
const INTRO_REPLY = `Hi, I'm **Nia**, your personal AI agent from OkVevo.

I work on your own computer, so I can use your **files, terminal and browser** the way a colleague would. A few things I do well:

- Reconcile statements and prepare drafts for you to review
- Research, write and organise everyday work
- Remember your formats, so you explain less every week

This is a preview, so I can only say hello here. [Download Nia](/nia) for Mac or Windows and give me something real to do.`

const FOLLOW_REPLY = `That's the idea. In this preview I only have a few lines to share, but the real Nia reads your files, does the work and comes back with it done.

Ready to see it on your own work? [Download Nia](/nia) for Mac or Windows.`

const SAMPLE_REPLY =
    'This is a sample session from the preview. [Download Nia](/nia) to keep real sessions, files and memory on your own computer.'

const seed = (id: string, title: string, age: string, section: Section): Session => ({
    id,
    title,
    age,
    section,
    turns: [{ id: 0, user: title, files: [], reply: SAMPLE_REPLY }],
})

const SEED: Session[] = [
    seed('gtm', 'Evaluate GTM tagline for Nia', '1h', 'now'),
    seed('bot', 'Build client research bot for accountants', '23h', 'yesterday'),
    seed('who', 'Hi, Who Are You.', '2d', 'week'),
    seed('skills', 'Overview of assistant skills.', '3d', 'week'),
    seed('tg', 'Friendly greeting', '14h', 'telegram'),
    seed('cron', 'Naru Noodle Bar Bookkeeping', 'in 2 days', 'cron'),
]

const NAV = [
    { icon: 'symbol-misc', label: 'Capabilities' },
    { icon: 'comment', label: 'Messaging' },
    { icon: 'files', label: 'Artifacts' },
    { icon: 'watch', label: 'Scheduled jobs' },
] as const

const titleFrom = (text: string, files: string[]) => {
    const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).slice(0, 6).join(' ').replace(/[.?!,;:]+$/, '')
    const title = words || (files[0] ? `Review ${files[0]}` : 'New session')
    return title.charAt(0).toUpperCase() + title.slice(1)
}

function Greeting() {
    const n = useTypewriter(HI)
    return (
        <div className="na-greet">
            <p className="na-hi" aria-label={HI}>
                <span className="na-hi-rest">{HI.slice(0, Math.min(n, 8))}</span>
                <span className="na-hi-name">{HI.slice(8, Math.min(n, 11))}</span>
                <span className="na-hi-rest">{HI.slice(11, n)}</span>
                {n < HI.length ? <span className="na-caret" aria-hidden /> : null}
            </p>
        </div>
    )
}

function Header({ label, icon }: { label: string; icon?: ReactNode }) {
    return (
        <div className="na-sec">
            {icon}
            <span className="na-sec-l">{label}</span>
        </div>
    )
}

function Divider({ label }: { label: string }) {
    return (
        <div className="na-div">
            <span className="na-div-l">{label}</span>
        </div>
    )
}

function NiaApp() {
    const [sessions, setSessions] = useState<Session[]>(SEED)
    const [activeId, setActiveId] = useState<string | null>(null)
    const [stream, setStream] = useState<{ sid: string; tid: number; chars: number } | null>(null)
    const [query, setQuery] = useState('')
    const count = useRef(0)

    const active = sessions.find((s) => s.id === activeId) ?? null
    const turns = active?.turns ?? []
    const thread = turns.length > 0

    // Streamed reply: reveal a few characters per tick, then drop the cursor.
    useEffect(() => {
        if (!stream) return
        const turn = sessions.find((s) => s.id === stream.sid)?.turns.find((t) => t.id === stream.tid)
        if (!turn || stream.chars >= turn.reply.length) return setStream(null)
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setStream(null)
        const id = window.setTimeout(
            () => setStream((s) => s && { ...s, chars: Math.min(turn.reply.length, s.chars + 3) }),
            22,
        )
        return () => window.clearTimeout(id)
    }, [stream, sessions])

    const newSession = () => {
        const empty = sessions.find((s) => s.fresh && s.turns.length === 0)
        if (empty) return setActiveId(empty.id)
        const id = `n${++count.current}`
        setSessions((all) => [{ id, title: 'New session', age: 'now', section: 'now', turns: [], fresh: true }, ...all])
        setActiveId(id)
    }

    const send = (text: string, files: string[]) => {
        const turn: Turn = { id: Date.now(), user: text, files, reply: thread ? FOLLOW_REPLY : INTRO_REPLY }
        const sid = active?.id ?? `n${++count.current}`
        if (active) {
            setSessions((all) =>
                all.map((s) =>
                    s.id === sid ? { ...s, title: s.turns.length ? s.title : titleFrom(text, files), turns: [...s.turns, turn] } : s,
                ),
            )
        } else {
            const created: Session = { id: sid, title: titleFrom(text, files), age: 'now', section: 'now', turns: [turn], fresh: true }
            setSessions((all) => [created, ...all])
            setActiveId(sid)
        }
        setStream({ sid, tid: turn.id, chars: 0 })
    }

    const stop = () => {
        if (!stream) return
        setSessions((all) =>
            all.map((s) =>
                s.id === stream.sid
                    ? { ...s, turns: s.turns.map((t) => (t.id === stream.tid ? { ...t, reply: t.reply.slice(0, stream.chars) } : t)) }
                    : s,
            ),
        )
        setStream(null)
    }

    const q = query.trim().toLowerCase()
    const rows = (section: Section) => sessions.filter((s) => s.section === section && (!q || s.title.toLowerCase().includes(q)))
    const row = (s: Session) => (
        <button
            key={s.id}
            type="button"
            className={`na-row${s.fresh ? ' is-new' : ''}`}
            aria-current={s.id === activeId ? 'true' : undefined}
            onClick={() => setActiveId(s.id)}
        >
            <span className="na-row-dot" aria-hidden />
            <span className="na-row-t">{s.title}</span>
            <span className="na-row-age">{s.age}</span>
        </button>
    )
    const now = rows('now')
    const yesterday = rows('yesterday')
    const week = rows('week')
    const telegram = rows('telegram')
    const cron = rows('cron')

    return (
        <div className="nia-win" role="application" aria-label="Nia app preview">
            <div className="na-lights" aria-hidden>
                <span />
                <span />
                <span />
            </div>
            <div className="na-tools na-tools-l" aria-hidden>
                <span className="na-tool"><Codicon name="layout-sidebar-left" /></span>
                <span className="na-tool"><Codicon name="arrow-swap" /></span>
            </div>
            <div className="na-tools na-tools-r" aria-hidden>
                <span className="na-tool"><Codicon name="comment-discussion" /></span>
                <span className="na-tool"><Codicon name="unmute" /></span>
                <span className="na-tool"><Codicon name="account" /></span>
                <span className="na-tool"><Codicon name="settings-gear" /></span>
            </div>

            <aside className="na-side">
                <div className="na-tabs" role="tablist">
                    <button type="button" role="tab" aria-selected className="na-tab">Sessions</button>
                    <button type="button" role="tab" aria-selected={false} aria-disabled className="na-tab" title="Bots live in the desktop app">Bots</button>
                </div>
                <nav className="na-nav" aria-label="Nia">
                    <button type="button" className="na-navrow" onClick={newSession}>
                        <Codicon name="robot" />
                        <span>New session</span>
                        <span className="na-kbds" aria-hidden>
                            <kbd className="na-kbd">⌘</kbd>
                            <kbd className="na-kbd">N</kbd>
                        </span>
                    </button>
                    {NAV.map((item) => (
                        <button key={item.label} type="button" className="na-navrow" aria-disabled title="Available in the desktop app">
                            <Codicon name={item.icon} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>
                <label className="na-search">
                    <Codicon name="search" />
                    <input
                        type="search"
                        value={query}
                        placeholder="Search sessions…"
                        aria-label="Search sessions"
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </label>
                <div className="na-list" data-lenis-prevent>
                    {q ? null : (
                        <>
                            <Header label="Pinned" />
                            <div className="na-pinhint">
                                <Codicon name="pin" />
                                <span>Shift-click a chat to pin</span>
                            </div>
                        </>
                    )}
                    {now.length || yesterday.length || week.length ? <Header label={q ? 'Results' : 'Sessions'} /> : null}
                    {now.map(row)}
                    {yesterday.length ? <Divider label="Yesterday" /> : null}
                    {yesterday.map(row)}
                    {week.length ? <Divider label="Earlier this week" /> : null}
                    {week.map(row)}
                    {telegram.length ? <Header label="Telegram" icon={<span className="na-plat"><Codicon name="comment" /></span>} /> : null}
                    {telegram.map(row)}
                    {cron.length ? <Header label="Cron jobs" /> : null}
                    {cron.map(row)}
                </div>
                <div className="na-foot" aria-hidden>
                    <span className="na-tool"><Codicon name="home" /></span>
                    <span className="na-tool"><span className="na-prof">D</span></span>
                    <span className="na-tool"><Codicon name="add" /></span>
                    <span className="na-tool"><Codicon name="cloud" /></span>
                </div>
            </aside>

            <div className="na-main" data-mode={thread ? 'thread' : 'intro'}>
                <div className="hero-face">
                    <NiaMark followCursor className="h-full w-full" />
                </div>
                {thread ? (
                    <Thread tick={`${active?.id}:${turns.length}:${stream?.chars ?? 0}`}>
                        {turns.map((turn) => (
                            <NiaTurn
                                key={turn.id}
                                user={turn.user}
                                files={turn.files}
                                reply={turn.reply}
                                chars={stream?.tid === turn.id ? stream.chars : undefined}
                            />
                        ))}
                    </Thread>
                ) : (
                    <Greeting key={active?.id ?? 'start'} />
                )}
                <div className="na-dock">
                    <NiaComposer
                        placeholders={thread ? FOLLOW_UP_PLACEHOLDERS : PLACEHOLDERS}
                        onSend={send}
                        busy={stream !== null}
                        onStop={stop}
                    />
                    {thread ? <p className="na-note">{NOTE}</p> : <p className="na-sub">{SUBTITLE}</p>}
                </div>
            </div>
        </div>
    )
}

/** Lays the app out at a fixed design size and scales it to the column. Imperative on purpose:
 *  the bear slot inside is measured by the scroll story, so the scale must land before paint. */
export default function NiaHeroApp() {
    const outer = useRef<HTMLDivElement>(null)
    const inner = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        const host = outer.current
        const box = inner.current
        if (!host || !box) return
        const fit = () => {
            const width = host.clientWidth
            if (!width) return
            const compact = width < 640
            const designW = compact ? 520 : 900
            const scale = Math.min(width / designW, 1)
            box.style.width = `${designW}px`
            box.style.height = `${DESIGN_H}px`
            box.style.transform = `scale(${scale})`
            box.style.setProperty('--s', String(scale))
            host.style.height = `${DESIGN_H * scale}px`
            box.firstElementChild?.toggleAttribute('data-compact', compact)
            host.dataset.ready = '1'
        }
        fit()
        const observer = new ResizeObserver(fit)
        observer.observe(host)
        return () => observer.disconnect()
    }, [])

    return (
        <div ref={outer} className="na-stage">
            <div ref={inner} className="na-stage-in">
                <NiaApp />
            </div>
        </div>
    )
}
