import type { Metadata } from 'next';
import PublicLayout from '@/components/shared/layouts/PublicLayout';
import CapabilityPan from '@/components/landing-page/CapabilityPan';
import HowNiaWorks from '@/components/landing-page/HowNiaWorks';

export const metadata: Metadata = {
    title: 'What Nia can do',
    description: 'Nia is a desktop agent. She works in sessions on your Mac or Windows computer, with tools, skills, and screen control you approve.',
    openGraph: {
        title: 'What Nia can do',
        description: 'Sessions, tools, skills, and approved screen control. Nia runs on your computer.',
    },
};

export default function FeaturesPage() {
    return (
        <PublicLayout>
            <>
                <CapabilityPan />
                <HowNiaWorks />
            </>
        </PublicLayout>
    );
}
