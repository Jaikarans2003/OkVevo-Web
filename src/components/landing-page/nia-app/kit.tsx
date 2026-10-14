'use client'

import '@vscode/codicons/dist/codicon.css'
import './nia-app.css'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import Link from 'next/link'
import ReactMarkdown, { type Components } from 'react-markdown'
import {
    IconArrowDown,
    IconCheck,
    IconChevronDown,
    IconEar,
    IconEarOff,
    IconFileText,
    IconMicrophone,
    IconPhoto,
    IconPlus,
    IconVolume2,
    IconVolumeOff,
    IconWaveSine,
    IconX,
} from '@tabler/icons-react'

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Codicon({ name, className = '' }: { name: string; className?: string }) {
    return <i aria-hidden className={`codicon codicon-${name} ${className}`} />
}

export function FileChip({ name, onRemove }: { name: string; onRemove?: () => void }) {
    const Icon = /\.(png|jpe?g|gif|webp|svg|heic)$/i.test(name) ? IconPhoto : IconFileText
    return (
        <span className="na-chip">
            <Icon size={14} stroke={1.75} aria-hidden />
            <span>{name}</span>
            {onRemove ? (
                <button type="button" aria-label={`Remove ${name}`} onClick={onRemove}>
                    <IconX size={11} stroke={2} aria-hidden />
                </button>
            ) : null}
        </span>
    )
}

const mdComponents: Components = {
    a: ({ href = '#', children }) =>
        href.startsWith('/') ? <Link href={href}>{children}</Link> : <a href={href}>{children}</a>,
}

/** One exchange. `chars` undefined = fully shown; otherwise the reply is still streaming. */
export function NiaTurn({
    user,
    files,
    reply,
    chars,
    output,
}: {
    user: string
    files: readonly string[]
    reply: string
    chars?: number
    output?: string
}) {
    const streaming = chars !== undefined && chars < reply.length
    return (
        <div className="na-turn">
            <div className="na-user">
                {files.map((name) => (
                    <FileChip key={name} name={name} />
                ))}
                {user ? <p>{user}</p> : null}
            </div>
            <div className="na-reply">
                <ReactMarkdown components={mdComponents}>{streaming ? reply.slice(0, chars) : reply}</ReactMarkdown>
                {streaming ? <span className="na-caret" aria-hidden /> : null}
                {!streaming && output ? <FileChip name={output} /> : null}
            </div>
        </div>
    )
}

/** Scrolling transcript that follows the newest text until the reader scrolls up. */
export function Thread({ children, tick }: { children: ReactNode; tick: unknown }) {
    const scroller = useRef<HTMLDivElement>(null)
    const stick = useRef(true)
    const [away, setAway] = useState(false)

    const onScroll = () => {
        const el = scroller.current
        if (!el) return
        const far = el.scrollHeight - el.scrollTop - el.clientHeight > 48
        stick.current = !far
        setAway(far)
    }

    useEffect(() => {
        const el = scroller.current
        if (el && stick.current) el.scrollTo({ top: el.scrollHeight })
    }, [tick])

    const jump = () => {
        const el = scroller.current
        if (!el) return
        stick.current = true
        setAway(false)
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }

    return (
        <div className="na-thread-wrap">
            <div ref={scroller} className="na-thread" data-lenis-prevent onScroll={onScroll}>
                {children}
            </div>
            {away ? (
                <button type="button" className="na-down" onClick={jump} aria-label="Scroll to latest">
                    <IconArrowDown size={16} stroke={1.75} />
                </button>
            ) : null}
        </div>
    )
}

/** Typewriter used by the empty-state greeting. */
export function useTypewriter(text: string, ms = 45): number {
    const [n, setN] = useState(0)
    useEffect(() => {
        if (reduceMotion()) return setN(text.length)
        setN(0)
        const id = window.setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), ms)
        return () => window.clearInterval(id)
    }, [text, ms])
    return n
}

/** Looping placeholder, same type-forward / type-back rhythm as the desktop composer. */
function usePlaceholder(pool: readonly string[], host: RefObject<HTMLElement | null>, paused: boolean) {
    const [text, setText] = useState('')
    useEffect(() => {
        if (paused) return setText('')
        if (reduceMotion()) return setText(pool[0])
        let sentence = 0
        let shown = 0
        let dir = 1
        let timer = 0
        const tick = () => {
            if (!host.current?.offsetParent) {
                timer = window.setTimeout(tick, 600)
                return
            }
            const full = pool[sentence % pool.length]
            shown += dir
            setText(full.slice(0, shown))
            let wait = 28
            if (dir === 1 && shown >= full.length) {
                dir = -1
                wait = 1100
            } else if (dir === -1 && shown <= 0) {
                dir = 1
                sentence++
                wait = 320
            }
            timer = window.setTimeout(tick, wait)
        }
        timer = window.setTimeout(tick, 28)
        return () => window.clearTimeout(timer)
    }, [pool, host, paused])
    return text
}

/** Desktop placeholder pools (brand/locales/desktop/en.ts: newSessionPlaceholders, followUpPlaceholders). */
export const PLACEHOLDERS = [
    'What are we building?',
    'Give Nia a task',
    "What's on your mind?",
    'Describe what you need',
    'What should we tackle?',
    'Ask anything',
    'Start with a goal',
] as const

export const FOLLOW_UP_PLACEHOLDERS = [
    'Send a follow-up',
    'Add more context',
    'Refine the request',
    "What's next?",
    'Keep it going',
    'Push it further',
    'Adjust or continue',
] as const

const MODELS = [
    { id: 'intelligence', label: 'Intelligence' },
    { id: 'cost', label: 'Cost-effective' },
] as const

type Picked = { id: number; name: string }

/**
 * The desktop composer. Typing and attaching always work. `onSend` is optional:
 * without it the send button is inert, which is what the accountant preview wants.
 */
export function NiaComposer({
    placeholders,
    onSend,
    busy = false,
    onStop,
    lean = false,
}: {
    placeholders: readonly string[]
    onSend?: (text: string, files: string[]) => void
    busy?: boolean
    onStop?: () => void
    /** Drop the ear + speaker toggles when the window is narrow. */
    lean?: boolean
}) {
    const [text, setText] = useState('')
    const [files, setFiles] = useState<Picked[]>([])
    const [model, setModel] = useState<(typeof MODELS)[number]['id']>('intelligence')
    const [open, setOpen] = useState(false)
    const [on, setOn] = useState({ mic: false, ear: false, voice: false })
    const wrap = useRef<HTMLDivElement>(null)
    const area = useRef<HTMLTextAreaElement>(null)
    const picker = useRef<HTMLInputElement>(null)
    const pillRef = useRef<HTMLButtonElement>(null)
    const seq = useRef(0)
    const hint = usePlaceholder(placeholders, wrap, text.length > 0)

    const ready = text.trim().length > 0 || files.length > 0
    const label = MODELS.find((m) => m.id === model)!.label

    const grow = () => {
        const el = area.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, 150)}px`
    }
    useEffect(grow, [text])

    useEffect(() => {
        if (!open) return
        const away = (event: PointerEvent) => {
            if (!wrap.current?.contains(event.target as Node)) setOpen(false)
        }
        const esc = (event: globalThis.KeyboardEvent) => {
            if (event.key !== 'Escape') return
            setOpen(false)
            pillRef.current?.focus()
        }
        window.addEventListener('pointerdown', away)
        window.addEventListener('keydown', esc)
        wrap.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]')?.focus()
        return () => {
            window.removeEventListener('pointerdown', away)
            window.removeEventListener('keydown', esc)
        }
    }, [open])

    const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]'))
        const at = items.indexOf(document.activeElement as HTMLElement)
        items[(at + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus()
    }

    const submit = () => {
        if (!onSend || busy || !ready) return
        onSend(text.trim(), files.map((f) => f.name))
        setText('')
        setFiles([])
    }

    const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
        event.preventDefault()
        submit()
    }

    const toggle = (key: keyof typeof on) => setOn((v) => ({ ...v, [key]: !v[key] }))

    return (
        <div ref={wrap} className="na-comp-wrap">
            <div className="na-comp" data-slot="composer-surface">
                {files.length ? (
                    <div className="na-attach">
                        {files.map((file) => (
                            <FileChip key={file.id} name={file.name} onRemove={() => setFiles((all) => all.filter((f) => f.id !== file.id))} />
                        ))}
                    </div>
                ) : null}
                <div className="na-comp-row">
                    <input
                        ref={picker}
                        type="file"
                        multiple
                        hidden
                        onChange={(event) => {
                            const picked = Array.from(event.target.files ?? []).map((f) => ({ id: ++seq.current, name: f.name }))
                            setFiles((all) => [...all, ...picked])
                            event.target.value = ''
                        }}
                    />
                    <button type="button" className="na-ctl" aria-label="Attach files" onClick={() => picker.current?.click()}>
                        <IconPlus size={16} stroke={1.75} />
                    </button>
                    <div className="na-input-box">
                        <textarea
                            ref={area}
                            className="na-input"
                            rows={1}
                            value={text}
                            spellCheck={false}
                            aria-label="Message Nia"
                            onChange={(event) => setText(event.target.value)}
                            onKeyDown={onKey}
                        />
                        {text.length === 0 ? (
                            <span className="na-ph" aria-hidden>
                                <span className="truncate">{hint}</span>
                                <span className="na-caret" />
                            </span>
                        ) : null}
                    </div>
                    <button
                        ref={pillRef}
                        type="button"
                        className="na-pill"
                        aria-haspopup="menu"
                        aria-expanded={open}
                        aria-label={`Model: ${label}`}
                        onClick={() => setOpen((v) => !v)}
                    >
                        <span>{label} · Med</span>
                        <i className="na-pill-dot" aria-hidden />
                        <IconChevronDown size={11} stroke={2} aria-hidden />
                    </button>
                    <button type="button" className="na-ctl" aria-label="Dictate" aria-pressed={on.mic} onClick={() => toggle('mic')}>
                        <IconMicrophone size={15} stroke={1.75} />
                    </button>
                    {lean ? null : (
                        <>
                            <button type="button" className="na-ctl" aria-label="Speak replies" aria-pressed={on.voice} onClick={() => toggle('voice')}>
                                {on.voice ? <IconVolume2 size={15} stroke={1.75} /> : <IconVolumeOff size={15} stroke={1.75} />}
                            </button>
                            <button type="button" className="na-ctl" aria-label="Wake word" aria-pressed={on.ear} onClick={() => toggle('ear')}>
                                {on.ear ? <IconEar size={15} stroke={1.75} /> : <IconEarOff size={15} stroke={1.75} />}
                            </button>
                        </>
                    )}
                    {busy ? (
                        <button type="button" className="na-send" aria-label="Stop" onClick={onStop}>
                            <span className="block size-2.5 rounded-[3px] bg-current" />
                        </button>
                    ) : ready ? (
                        <button
                            type="button"
                            className="na-send"
                            aria-label="Send"
                            aria-disabled={!onSend}
                            title={onSend ? undefined : 'Preview only. Download Nia to send.'}
                            onClick={submit}
                        >
                            <Codicon name="arrow-up" className="text-sm" />
                        </button>
                    ) : (
                        <button type="button" className="na-send" aria-label="Start voice conversation" onClick={() => toggle('voice')}>
                            <IconWaveSine size={15} stroke={1.75} />
                        </button>
                    )}
                </div>
            </div>
            {open ? (
                <div className="na-menu" role="menu" aria-label="Model" onKeyDown={onMenuKey}>
                    {MODELS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={model === item.id}
                            className="na-menu-item"
                            onClick={() => {
                                setModel(item.id)
                                setOpen(false)
                                pillRef.current?.focus()
                            }}
                        >
                            {item.label}
                            {model === item.id ? <IconCheck size={14} stroke={2} aria-hidden /> : null}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    )
}
