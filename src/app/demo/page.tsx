import type { Metadata } from 'next';
import PublicLayout from '@/components/layouts/PublicLayout';
import Demo from '@/components/ook/Demo';

export const metadata: Metadata = {
    title: 'Demo - See OKVEVO in Action | AI Video Generation',
    description: 'Watch how OKVEVO transforms your concepts into stunning videos. See our AI-powered video generation in action from concept to result.',
    keywords: ['AI video demo', 'video generation demo', 'OKVEVO demo', 'text to video example'],
};

export default function DemoPage() {
    return (
        <PublicLayout>
            <Demo />
        </PublicLayout>
    );
}
