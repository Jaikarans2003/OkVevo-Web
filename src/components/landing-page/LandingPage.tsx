'use client';

import { useEffect, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { auth } from '@/config/firebase';
import { env } from '@/config/env';
import JsonLd from '@/components/shared/JsonLd';
import Navbar from './Navbar';
import DrawnArt from './DrawnArt';
import GroupChats from './GroupChats';
import { PillarIcon, type PillarName } from './stages/pillars';
import './okvevo-landing.css';

const SmoothScroll = dynamic(() => import('./SmoothScroll'), { ssr: false });
// Stages pick wide or compact from their measured width, so they render on the client only.

const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'OkVevo',
    url: env.siteUrl,
    logo: `${env.siteUrl}/OKVEVO%20Logos%20With%20BackGrounds/OrangeBackGround.svg`,
    sameAs: [
        'https://instagram.com/okvevo',
        'https://linkedin.com/company/okvevo',
        'https://x.com/OKVEVO_AI',
    ],
};

const SECTIONS = [
    { name: 'The Problem', href: '#problem' },
    { name: 'The System', href: '#system' },
    { name: 'Five Pillars', href: '#pillars' },
    { name: 'How It Works', href: '#how' },
    { name: 'For Networks', href: '#networks' },
    { name: 'Contact', href: '#contact' },
];

const ROUTES = [
    { name: 'Pricing', href: '/pricing' },
    { name: 'Nia', href: '/nia' },
];

const LEGAL = [
    { name: 'Privacy', href: '/legal#privacy-policy' },
    { name: 'Terms', href: '/legal#terms-of-use' },
];

const PROBLEMS: { tag: PillarName; title: string; body: string }[] = [
    { tag: 'Sales', title: 'Leads come in. Follow-ups fall behind.', body: 'Enquiries arrive from everywhere. Responses get delayed, conversations get lost, and potential customers move on.' },
    { tag: 'Finance', title: 'Money comes in. Reconciliation waits.', body: 'Payments, expenses, invoices and renewals need constant attention. Without connected processes, financial clarity takes too much effort.' },
    { tag: 'Marketing', title: 'Marketing is always next on the list.', body: 'Campaigns, content and promotions need consistency. But when daily work takes over, marketing becomes an occasional activity.' },
    { tag: 'Technology', title: 'Technology becomes another responsibility.', body: 'The tools, integrations, booking systems and internal software that support a business also need to be built, maintained and improved.' },
    { tag: 'Operations', title: 'Operations depend on people remembering everything.', body: 'Tasks, schedules, handovers and everyday decisions keep moving only when someone is there to coordinate them.' },
];

const PILLARS: { name: PillarName; body: string }[] = [
    { name: 'Technology', body: 'The systems, software, tools and integrations that make the business work.' },
    { name: 'Finance', body: 'The payments, accounting, reconciliation and financial processes that keep the business accountable.' },
    { name: 'Marketing', body: 'The content, campaigns, communication and activities that create demand.' },
    { name: 'Sales', body: 'The enquiries, conversations, follow-ups and conversions that bring in revenue.' },
    { name: 'Operations', body: 'The workflows, coordination, execution and everyday processes that deliver the service.' },
];

const PRINCIPLES = [
    { title: 'Understands your business', body: 'OkVevo is configured around your processes, rules, requirements and way of working.' },
    { title: 'Does the actual work', body: 'It doesn’t stop at recommendations or generated answers. It executes workflows, coordinates tasks and moves work forward.' },
    { title: 'Works as one system', body: 'The five pillars are connected. Information from one process can inform and support another, reducing disconnected work and unnecessary handovers.' },
];

const RULES = [
    { title: 'Custom workflows', body: 'We map how your business works and configure workflows around your actual processes, not generic templates.' },
    { title: 'Specialised capabilities', body: 'Deploy only the pillars and specialised workflows you need, or bring the complete operating system together.' },
    { title: 'Your business IP stays yours', body: 'Your internal processes, operating rules and custom workflows are specific to your deployment. They are not automatically shared with other businesses.' },
    { title: 'Works with your existing environment', body: 'OkVevo is designed to work with the tools, systems and processes already supporting your business, wherever integration is appropriate.' },
];

const TEAM = [
    { role: 'Start', title: 'One-time setup and configuration', body: 'We understand your requirements, map your workflows and build the operating system around them.', wide: true },
    { role: 'Designs', title: 'Solution Architect', body: 'Designs the overall system, its capabilities and how the different workflows work together.' },
    { role: 'Deploys', title: 'Forward-Deployed Engineer', body: 'Works closely with your team to integrate, deploy and adapt the system to real operating conditions.' },
    { role: 'Knows the domain', title: 'Subject Matter Expert', body: 'Brings the domain knowledge required to understand your business processes and ensure the workflows reflect how your industry operates.' },
    { role: 'Always', title: 'Ongoing improvement', body: 'As your requirements evolve, the system can be refined and extended to support new workflows and capabilities.', wide: true },
];

const NETWORK_TYPES = ['Aggregators', 'Platforms', 'Associations', 'Franchise networks', 'Other business networks'];

const NETWORK_STEPS = [
    { title: 'Understand the network', body: 'We work with your team to understand the businesses you serve, their operating models and the workflows that need to be supported.' },
    { title: 'Configure the system', body: 'We build a deployment around your network’s requirements. Start with a specialised pillar, such as Operations, or deploy the complete five-pillar operating system.' },
    { title: 'Deploy across the network', body: 'We configure and roll out the relevant capabilities to the businesses in your network, adapting workflows to their requirements.' },
    { title: 'Operate and evolve', body: 'Your network gets a dedicated deployment approach, expert support and a system that can expand as your requirements grow.' },
];

// spot inks shared with the drawn art in public/art (see art/okart.py)
const TEAL = 'var(--teal)', RUST = 'var(--rust)', OCHRE = 'var(--ochre)', OLIVE = 'var(--olive)', SLATE = 'var(--slate)', ORANGE = 'var(--orange)';
const SPOT: Record<PillarName, string> = { Technology: TEAL, Finance: OCHRE, Marketing: RUST, Sales: OLIVE, Operations: SLATE };
const HERO_LAYERS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

const CLIENTS = [
    { name: 'Kendra Holdings', src: '/Companies/mono/kendra-holdings.png', w: 1714 },
    { name: 'OnStar TV', src: '/Companies/mono/onstar-tv.png', w: 787 },
    { name: 'Vruddhi Study Centre', src: '/Companies/mono/vruddhi.png', w: 470 },
];

export default function LandingPage() {
    const router = useRouter();

    // A signed-in user arriving fresh in this tab goes to billing (the layout's head script sets data-arrival).
    // Coming back to "/" later, by link, back button or reload, keeps them here. Consumed once auth answers.
    useEffect(() => {
        const root = document.documentElement;
        if (root.dataset.arrival !== '1') return;
        return onAuthStateChanged(auth, (currentUser) => {
            if (root.dataset.arrival !== '1') return;
            delete root.dataset.arrival;
            if (currentUser) router.replace('/billing');
        });
    }, [router]);

    return (
        <div className="ok-landing min-h-screen">
            <JsonLd data={websiteSchema} />
            <SmoothScroll />

            <Navbar />

            <main id="main">
                <section className="hero" aria-labelledby="hero-t">
                    <div className="hero-grid">
                        <div className="hero-copy nia-rise">
                            <h1 id="hero-t">Every business has five core functions. <span>Why are they still managed separately?</span></h1>
                            <p className="sub">Technology, Finance, Marketing, Sales and Operations run on scattered tools and teams. OkVevo brings them into one AI-powered operating system.</p>
                            <div className="hero-cta">
                                <a className="btn btn--go" href="#system">Explore the operating system</a>
                                <a className="btn" href="#contact">Talk to founders</a>
                            </div>
                        </div>
                        <DrawnArt name="hero" layers={9} width={1400} height={1050} float={[3, 4, 5, 6, 7]} className="hero-art"
                            alt="Five pillars of a business, a gear, coins, a megaphone, a sales chart and a clipboard, orbiting one OkVevo window" />
                    </div>
                    <div className="hero-logos">
                        <p>Deployed at</p>
                        <div className="marquee">
                            {[0, 1].map((k) => (
                                <ul key={k} aria-hidden={k ? true : undefined}>
                                    {[...CLIENTS, ...CLIENTS].map((c, i) => <li key={i}><img src={c.src} alt={k || i >= CLIENTS.length ? '' : c.name} width={c.w} height={200} /></li>)}
                                </ul>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="sec sheet sheet--dark on-dark" id="pillars" aria-labelledby="pil-t">
                    <div className="wrap">
                        <div className="sec-head">
                            <h2 id="pil-t">Every business runs on five fundamental pillars.</h2>
                            <p>The industry may change. The customers may change. The workflows may look completely different. But the fundamental work behind every business remains remarkably similar.</p>
                        </div>
                        <div className="temple">
                            <div className="temple-art">
                                <DrawnArt name="pillars" layers={5} width={1600} height={920} float={[4]} className="drawn--dark" alt="A temple: an orange roof labelled Your business, held up by five coloured columns" />
                                <span className="temple-label" aria-hidden="true">Your business</span>
                            </div>
                            <ol className="p5">
                                {PILLARS.map((p, i) => (
                                    <li key={p.name} className="nia-row" style={{ '--spot': SPOT[p.name] } as CSSProperties}>
                                        <span className="p5-icon" aria-hidden="true"><PillarIcon name={p.name} size={16} />{`0${i + 1}`}</span>
                                        <h3>{p.name}</h3>
                                        <p>{p.body}</p>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>
                </section>

                <section className="sec" id="problem" aria-labelledby="prob-t">
                    <div className="wrap">
                        <div className="sec-head">
                            <h2 id="prob-t">The work behind the business is becoming the business.</h2>
                            <p>Running a business means much more than delivering a product or service. There is an entire system of work behind every customer, transaction and decision.</p>
                        </div>
                        <div className="prob-scene">
                            <DrawnArt name="problem" layers={5} width={1400} height={962} float={[4]} className="prob-art" alt="A business owner at his desk, chin on his hand, papers flying around him" />
                            {PROBLEMS.map((p) => (
                                <article key={p.tag} className={`pcard pcard--${p.tag.toLowerCase()} nia-row`} style={{ '--spot': SPOT[p.tag] } as CSSProperties}>
                                    <span className="tag"><PillarIcon name={p.tag} size={14} />{p.tag}</span><h3>{p.title}</h3><p>{p.body}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="sec sheet sheet--teal on-dark" id="system" aria-labelledby="sys-t">
                    <div className="wrap">
                        <div className="sec-head sec-head--center">
                            <h2 id="sys-t">What if all five pillars worked together?</h2>
                        </div>
                        <div className="sys-grid">
                        <div className="principles">
                            {PRINCIPLES.map((p, i) => (
                                <article key={p.title} className="prin nia-row" style={{ '--spot': [OCHRE, TEAL, RUST][i] } as CSSProperties}>
                                    <span className="k" aria-hidden="true">{i + 1}</span><h3>{p.title}</h3><p>{p.body}</p>
                                </article>
                            ))}
                        </div>
                        <GroupChats />
                        </div>
                        <p className="notask hand">Not another AI assistant to ask. An operating system that works.</p>
                    </div>
                </section>

                <section className="sec ledger" aria-labelledby="rules-t">
                    <div className="wrap rules-grid">
                        <div className="sec-head sec-head--stack">
                            <p className="kicker"><i style={{ background: 'var(--slate)' }} />04</p>
                            <h2 id="rules-t">Your workflows. Your rules. Your operating system.</h2>
                            <div className="rules-intro">
                                <p>No two businesses operate in exactly the same way. Their processes, approvals, responsibilities and internal knowledge are part of what makes them different.</p>
                                <p>OkVevo is configured to reflect those differences.</p>
                            </div>
                        </div>
                        <ul className="rlist">
                            {RULES.map((r, i) => (
                                <li key={r.title} className="nia-row" style={{ '--spot': [TEAL, OCHRE, ORANGE, SLATE][i] } as CSSProperties}><span className="rnum" aria-hidden="true">{`0${i + 1}`}</span><h3>{r.title}</h3><p>{r.body}</p></li>
                            ))}
                        </ul>
                    </div>
                </section>

                <section className="sec sheet sheet--olive on-dark" id="how" aria-labelledby="svc-t">
                    <div className="wrap">
                        <div className="sec-head">
                            <p className="kicker"><i style={{ background: 'var(--teal)' }} />05 · How it works</p>
                            <h2 id="svc-t">We don’t just give you software. We put it to work.</h2>
                            <div className="service-intro">
                                <p>Traditional software gives you access and leaves implementation, configuration and adoption to your team. OkVevo takes a different approach.</p>
                                <p>We configure, deploy and support your operating system as a service, working alongside your people to make sure it fits the way your business operates.</p>
                            </div>
                        </div>
                        <div className="road">
                            <DrawnArt name="how" layers={7} width={1600} height={700} float={[1, 2, 3, 4, 5]} className="drawn--dark"
                                alt="A road with five stops: a flag, a blueprint, a plug, an open book and looping arrows" />
                            <ol className="road-stops" aria-label="How we work with you">
                                {TEAM.map((t, i) => (
                                    <li key={t.title} className="nia-row" style={{ '--spot': [ORANGE, TEAL, OCHRE, RUST, OLIVE][i] } as CSSProperties}>
                                        <span className="role">{t.role}</span><h3>{t.title}</h3><p>{t.body}</p>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>
                </section>

                <section className="sec sheet sheet--sand" id="networks" aria-labelledby="net-t">
                    <div className="wrap">
                        <div className="net-grid">
                            <div className="net-copy">
                                <h2 id="net-t">One operating system. An entire network of businesses.</h2>
                                <p>Business networks already bring businesses, people and opportunities together. OkVevo makes it possible to bring the operating capabilities of an AI-powered business OS to the businesses within that network.</p>
                                <p className="flow-cap">We work with organisations that serve multiple businesses:</p>
                                <ul className="who-list">
                                    {NETWORK_TYPES.map((w, i) => <li key={w} style={{ '--spot': [TEAL, OCHRE, RUST, OLIVE, SLATE][i] } as CSSProperties}>{w}</li>)}
                                </ul>
                            </div>
                            <DrawnArt name="network" layers={8} width={1400} height={1000} float={[3, 4, 5, 6]}
                                alt="A network's head office in the middle, with dashed lines out to eight shops, each with an orange OkVevo badge" />
                        </div>
                        <ol className="net-steps">
                            {NETWORK_STEPS.map((s, i) => (
                                <li key={s.title} className="nia-row" style={{ '--spot': [TEAL, OCHRE, RUST, ORANGE][i] } as CSSProperties}><span className="num">{`0${i + 1}`}</span><h3>{s.title}</h3><p>{s.body}</p></li>
                            ))}
                        </ol>
                        <p className="close">Your network brings the businesses together. <b>OkVevo brings the operating system to them.</b></p>
                    </div>
                </section>

                <section className="sec cta" id="contact" aria-labelledby="cta-t">
                    <div className="wrap cta-grid">
                        <h2 id="cta-t">Let’s put your business to work differently.</h2>
                        <div>
                            <p>Tell us about your business, your workflows and the work you want to automate. We’ll help you identify where OkVevo can make the biggest difference.</p>
                            <div className="cta-actions">
                                <a className="btn btn--go" href="mailto:info@okvevo.com">Talk to founders</a>
                                <small>Booking calendar coming soon. Until then, write to info@okvevo.com.</small>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="foot on-dark">
                <div className="wrap foot-grid">
                    <div>
                        <img className="foot-logo" src="/OKVEVO%20Logos%20WithOut%20BackGrounds/Orange.svg" alt="OkVevo" width={500} height={500} />
                        <p className="foot-tag"><b>The AI business operating system.</b>OkVevo connects Technology, Finance, Marketing, Sales and Operations into one AI business operating system, configured and run around the way your business works.</p>
                    </div>
                    <div className="foot-row">
                        <nav aria-labelledby="foot-menu">
                            <h3 id="foot-menu">Menu</h3>
                            {SECTIONS.map((link) => <a key={link.href} href={link.href}>{link.name}</a>)}
                            {ROUTES.map((link) => <Link key={link.href} href={link.href}>{link.name}</Link>)}
                        </nav>
                        <nav aria-labelledby="foot-legal">
                            <h3 id="foot-legal">Legal</h3>
                            {LEGAL.map((link) => <Link key={link.href} href={link.href}>{link.name}</Link>)}
                        </nav>
                    </div>
                    <a className="foot-mail" href="mailto:info@okvevo.com">info@okvevo.com</a>
                </div>
            </footer>
        </div>
    );
}
