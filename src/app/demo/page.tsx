import type { Metadata } from 'next';
import PublicLayout from '@/components/shared/layouts/PublicLayout';
import HowNiaWorks from '@/components/landing-page/HowNiaWorks';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'How Nia works',
    description: 'A Nia session: you ask, she uses tools on your computer, you approve changes, and the transcript stays on the machine.',
    openGraph: {
        title: 'How Nia works',
        description: 'Ask, act, approve, keep. A session on your computer.',
    },
};

export default function DemoPage() {
    return (
        <PublicLayout>
            <div>
                <HowNiaWorks />
                <div className="bg-[#f6f1ec] flex justify-center px-6 pb-28">
                    <Link
                        href="/nia"
                        className="mx-auto inline-flex h-12 items-center rounded-full bg-[#ff6d1f] px-6 text-sm font-medium text-[#2b2b2b] active:scale-[0.98]"
                    >
                        Download
                    </Link>
                </div>
            </div>
        </PublicLayout>
    );
}
