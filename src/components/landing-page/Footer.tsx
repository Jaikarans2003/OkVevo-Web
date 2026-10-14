import Link from 'next/link';
import { Instagram, Linkedin } from 'lucide-react';

const COLUMNS = [
    {
        label: 'Product',
        links: [
            { name: 'How it works', href: '/#how' },
            { name: 'Why Nia', href: '/#why' },
            { name: 'Pricing', href: '/pricing' },
            { name: 'FAQ', href: '/#faq' },
        ],
    },
    {
        label: 'Legal',
        links: [
            { name: 'Privacy', href: '/legal#privacy-policy' },
            { name: 'Terms', href: '/legal#terms-of-use' },
        ],
    },
    {
        label: 'Account',
        links: [{ name: 'Sign in', href: '/login' }],
    },
];

function XMark() {
    return (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
    );
}

const SOCIAL = [
    { name: 'Instagram', href: 'https://instagram.com/okvevo', icon: <Instagram size={17} strokeWidth={1.75} aria-hidden /> },
    { name: 'LinkedIn', href: 'https://linkedin.com/company/okvevo', icon: <Linkedin size={17} strokeWidth={1.75} aria-hidden /> },
    { name: 'X', href: 'https://x.com/OKVEVO_AI', icon: <XMark /> },
];

export default function Footer() {
    return (
        <footer className="bg-[#F4F2EE] px-6 pb-10 pt-16 text-center text-[#2A2A2A]">
            <Link href="/" aria-label="OkVevo home" className="inline-flex">
                <img src="/OKVEVO%20Logos%20WithOut%20BackGrounds/Orange.svg" alt="" className="mx-auto h-14 w-14" />
            </Link>
            <ul className="mt-6 flex items-center justify-center gap-3">
                {SOCIAL.map((item) => (
                    <li key={item.href}>
                        <a
                            href={item.href}
                            aria-label={item.name}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#2A2A2A]/15 text-[#2A2A2A]/80 transition-colors hover:border-[#FF6F20] hover:bg-white hover:text-[#FF6F20] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6F20]"
                            target="_blank"
                            rel="noreferrer"
                        >
                            {item.icon}
                        </a>
                    </li>
                ))}
            </ul>
            <div className="mx-auto mt-10 flex max-w-[720px] flex-col justify-center gap-8 sm:flex-row sm:gap-16">
                {COLUMNS.map((column) => (
                    <div key={column.label}>
                        <p className="text-xs font-medium tracking-[0.06em] text-[#8A857D] uppercase">{column.label}</p>
                        <ul className="mt-3 space-y-2">
                            {column.links.map((link) => (
                                <li key={link.href}>
                                    <Link href={link.href} className="text-sm text-[#2A2A2A]/80 transition-colors hover:text-[#FF6F20]">
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            <div className="mx-auto mt-12 max-w-[720px] border-t border-[#2A2A2A]/10 pt-6">
                <p className="text-sm text-[#8A857D]">OkVevo by Azonova Technologies Pvt Ltd · Bengaluru</p>
                <a className="mt-1 inline-block text-sm underline underline-offset-4" href="mailto:info@azonovatechnologies.com">
                    info@azonovatechnologies.com
                </a>
            </div>
        </footer>
    );
}
