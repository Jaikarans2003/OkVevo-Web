'use client';

import { useEffect, useRef, useState } from 'react';
import { BOT_FACES } from './stages/bot-faces';
import type { PillarName } from './stages/pillars';
import './group-chats.css';

type Bot = PillarName | 'OkVevo agent';
type Group = { pillar: PillarName; title: string; about: string; members: Bot[]; prompt: string; replies: [Bot, string][] };

// One group chat per pillar department in the Nia app: a prompt from you, then each bot in that
// group answers in turn. Pick any group; left alone it moves on to the next one, so it loops.
const GROUPS: Group[] = [
    {
        pillar: 'Technology', title: 'Build and maintain.',
        about: 'Build business applications, internal tools, booking systems, integrations and digital infrastructure. Keep the technology supporting your workflows working as it should.',
        members: ['Technology', 'Operations', 'OkVevo agent'],
        prompt: 'Our booking page breaks on mobile. Fix it and tell operations when it’s live.',
        replies: [
            ['Technology', 'Found it: the date picker overflows on small screens. Patched and tested on iPhone and Android.'],
            ['Technology', 'The fix is live on the booking page.'],
            ['Operations', 'Thanks. Weekend slots are open for bookings again.'],
            ['OkVevo agent', 'Logged under Technology › Maintenance. No open issues left.'],
        ],
    },
    {
        pillar: 'Finance', title: 'Track and reconcile.',
        about: 'Monitor transactions, match payments, manage invoices, track expenses and automate recurring financial processes.',
        members: ['Finance', 'Sales', 'OkVevo agent'],
        prompt: 'Reconcile last week’s payments and follow up on anything unpaid.',
        replies: [
            ['Finance', 'Matched 42 of 45 payments to their invoices. 3 invoices are still unpaid, ₹38,400 in total.'],
            ['Finance', 'Sent a polite reminder with a payment link to all three.'],
            ['Sales', 'One of them asked us for a revised quote. I’ll send it today.'],
            ['OkVevo agent', 'The weekly reconciliation is saved in Finance › Reports.'],
        ],
    },
    {
        pillar: 'Marketing', title: 'Create and communicate.',
        about: 'Plan campaigns, generate content, prepare creatives, schedule publishing and manage marketing workflows.',
        members: ['Marketing', 'Sales', 'OkVevo agent'],
        prompt: 'Plan this month’s festive campaign for Instagram and email.',
        replies: [
            ['Marketing', 'Drafted a three-week plan: a teaser, the offer launch and a last-chance reminder. 6 posts and 2 emails.'],
            ['Marketing', 'The creatives are ready for your review. Publishing starts Monday at 10 am.'],
            ['Sales', 'I’ll tag every enquiry the campaign brings in, so we can see what works.'],
            ['OkVevo agent', 'Added to the content calendar. Results every Friday.'],
        ],
    },
    {
        pillar: 'Sales', title: 'Respond and convert.',
        about: 'Capture enquiries, qualify prospects, respond to customers, manage follow-ups and move opportunities through the sales process.',
        members: ['Sales', 'Marketing', 'OkVevo agent'],
        prompt: 'Reply to the new website enquiries and book calls with the good fits.',
        replies: [
            ['Sales', 'Answered 7 new enquiries within 5 minutes. 4 look like a good fit.'],
            ['Sales', 'Booked 3 calls this week. The fourth wants to talk next month, so a follow-up is set.'],
            ['Marketing', '5 of the 7 came from the festive post. Noted for next month’s plan.'],
            ['OkVevo agent', 'Pipeline updated: 3 calls, 1 follow-up, 3 closed as not a fit.'],
        ],
    },
    {
        pillar: 'Operations', title: 'Coordinate and execute.',
        about: 'Manage schedules, assign tasks, coordinate teams, maintain workflows, handle recurring processes and generate operational reports.',
        members: ['Operations', 'Finance', 'OkVevo agent'],
        prompt: 'Schedule next week’s service visits and send me a daily report.',
        replies: [
            ['Operations', 'Scheduled 18 visits across 4 technicians with no overlaps. Every customer has a confirmation.'],
            ['Operations', 'Your daily report arrives at 7 pm: completed, pending and rescheduled visits.'],
            ['Finance', 'I’ll raise each invoice as soon as a visit is marked complete.'],
            ['OkVevo agent', 'Set to repeat every Monday. Tell me if anything changes.'],
        ],
    },
];

const TYPE_MS = 1100, GAP_MS = 350, NEXT_MS = 5000;
// Always the desktop app (sidebar + chat): narrower than this, it is drawn at this width and scaled down to fit.
const DESIGN_W = 600, DESIGN_H = 560;

function Face({ bot, size }: { bot: Bot; size: number }) {
    return <img className="gc-face" src={`data:image/svg+xml;utf8,${encodeURIComponent(BOT_FACES[bot])}`} width={size} height={size} alt="" />;
}

export default function GroupChats() {
    const [g, setG] = useState(0);
    const [shown, setShown] = useState(0);            // 0 nothing, 1 the prompt, 1 + n the first n replies
    const [typing, setTyping] = useState(false);
    const [inView, setInView] = useState(false);
    const auto = useRef(true);                        // stops moving on its own once someone picks a group
    const root = useRef<HTMLDivElement>(null);
    const feed = useRef<HTMLDivElement>(null);
    const fit = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const group = GROUPS[g];

    useEffect(() => {
        const el = fit.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / DESIGN_W)));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
        if (root.current) io.observe(root.current);
        return () => io.disconnect();
    }, []);

    // play the open group: prompt, then each reply after a moment of typing; then on to the next group
    useEffect(() => {
        if (!inView) return;
        let t = 0;
        const total = 1 + GROUPS[g].replies.length;
        const step = (n: number) => {
            if (n > total) {
                if (auto.current) t = window.setTimeout(() => setG((x) => (x + 1) % GROUPS.length), NEXT_MS);
                return;
            }
            if (n === 1) { setShown(1); t = window.setTimeout(() => step(2), GAP_MS + 300); return; }
            setTyping(true);
            t = window.setTimeout(() => { setTyping(false); setShown(n); t = window.setTimeout(() => step(n + 1), GAP_MS); }, TYPE_MS);
        };
        setShown(0); setTyping(false);
        t = window.setTimeout(() => step(1), 400);
        return () => clearTimeout(t);
    }, [g, inView]);

    useEffect(() => {
        const f = feed.current;
        if (f) f.scrollTo({ top: f.scrollHeight, behavior: 'smooth' });
    }, [shown, typing]);

    const pick = (i: number) => { auto.current = false; setG(i); };
    const typer = group.replies[Math.min(Math.max(0, shown - 1), group.replies.length - 1)][0];   // who is typing the next reply

    const scaled = scale < 1;
    return (
        <div className="gc-fit" ref={fit} style={scaled ? { height: DESIGN_H * scale } : undefined}>
        <div className="gc" ref={root} style={scaled ? { flex: 'none', width: DESIGN_W, minHeight: 0, height: DESIGN_H, transform: `scale(${scale})`, transformOrigin: '0 0' } : undefined}>
            <div className="gc-bar" aria-hidden="true"><i /><i /><i /><span>Group chats</span></div>
            <div className="gc-body">
                <nav className="gc-side" aria-label="Group chats">
                    {GROUPS.map((x, i) => (
                        <button key={x.pillar} type="button" className="gc-group" aria-pressed={i === g} onClick={() => pick(i)}>
                            <span className="gc-pile">{x.members.slice(0, 3).map((m) => <Face key={m} bot={m} size={22} />)}</span>
                            <span className="gc-group__text"><b>{x.pillar}</b><span>{x.title}</span></span>
                        </button>
                    ))}
                </nav>
                <section className="gc-chat" aria-label={`${group.pillar} group chat`}>
                    <header className="gc-head">
                        <div><b>{group.pillar}</b><span>{group.members.length} members · {group.members.join(', ')}</span></div>
                        <span className="gc-pile">{group.members.map((m) => <Face key={m} bot={m} size={24} />)}</span>
                    </header>
                    <div className="gc-feed" ref={feed}>
                        <p className="gc-about">{group.about}</p>
                        {shown >= 1 && <p className="gc-msg gc-msg--you">{group.prompt}</p>}
                        {group.replies.slice(0, Math.max(0, shown - 1)).map(([bot, text], i) => (
                            <div key={i} className="gc-msg gc-msg--bot">
                                <Face bot={bot} size={28} />
                                <div><b>{bot}</b><p>{text}</p></div>
                            </div>
                        ))}
                        {typing && (
                            <div className="gc-msg gc-msg--bot gc-typing" aria-hidden="true">
                                <Face bot={typer} size={28} />
                                <div><b>{typer}</b><p><i /><i /><i /></p></div>
                            </div>
                        )}
                    </div>
                    <p className="gc-composer">Message {group.pillar}…</p>
                </section>
            </div>
        </div>
        </div>
    );
}
