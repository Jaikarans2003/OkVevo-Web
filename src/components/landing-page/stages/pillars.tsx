import { Code, Handshake, Megaphone, Wallet, Workflow, type LucideIcon } from 'lucide-react';

export type PillarName = 'Technology' | 'Finance' | 'Marketing' | 'Sales' | 'Operations';

export const PILLAR_ICON: Record<PillarName, LucideIcon> = {
    Technology: Code,
    Finance: Wallet,
    Marketing: Megaphone,
    Sales: Handshake,
    Operations: Workflow,
};

/** Page order, as the five pillars are listed in the copy. */
export const PILLAR_ORDER: PillarName[] = ['Technology', 'Finance', 'Marketing', 'Sales', 'Operations'];

/** One customer journey, enquiry to payment, in the copy's workflow order. */
export const JOURNEY: { pillar: PillarName; task: string }[] = [
    { pillar: 'Sales', task: 'Enquiry answered' },
    { pillar: 'Marketing', task: 'Campaign scheduled' },
    { pillar: 'Technology', task: 'Booking page updated' },
    { pillar: 'Operations', task: 'Service assigned' },
    { pillar: 'Finance', task: 'Payment matched' },
];

export function PillarIcon({ name, size = 15 }: { name: PillarName; size?: number }) {
    const Glyph = PILLAR_ICON[name];
    return <Glyph size={size} strokeWidth={1.75} aria-hidden />;
}
