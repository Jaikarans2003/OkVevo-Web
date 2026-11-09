'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { LogOut } from 'lucide-react';
import { auth } from '@/config/firebase';
import '@/components/landing-page/okvevo-landing.css';
import './portal.css';

const LOGO = '/OKVEVO%20Logos%20WithOut%20BackGrounds/Orange.svg';
const LINKS = [
    { name: 'Billing', href: '/billing' },
    { name: 'Profile', href: '/profile' },
];

// Frame for the account pages: the landing's paper, inks and printed top bar.
// Signed out (login) the bar only leads back to the site.
export default function PortalShell({ children, signedIn = true }: { children: React.ReactNode; signedIn?: boolean }) {
    const pathname = usePathname();
    const router = useRouter();

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            router.push('/login');
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    return (
        <div className="ok-landing portal">
            <header className="pt-bar">
                <div className="pt-bar-in">
                    <Link href="/" aria-label="OkVevo home" className="pt-logo">
                        <img src={LOGO} alt="" width={44} height={44} />
                    </Link>
                    {signedIn ? (
                        <nav aria-label="Account">
                            {LINKS.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="pt-link"
                                    aria-current={pathname?.startsWith(link.href) ? 'page' : undefined}
                                >
                                    {link.name}
                                </Link>
                            ))}
                            <button type="button" className="pt-link" onClick={handleSignOut} aria-label="Sign out">
                                <LogOut size={15} strokeWidth={1.75} aria-hidden />
                                <span className="lbl-long">Sign out</span>
                            </button>
                        </nav>
                    ) : (
                        <Link href="/" className="pt-link">Back to site</Link>
                    )}
                </div>
            </header>
            <main id="main" className="pt-main">{children}</main>
        </div>
    );
}
