import type { Metadata } from 'next';
import { env } from '@/config/env';

export const metadata: Metadata = {
  title: 'Download OkVevo | Mac and Windows',
  description: 'Download OkVevo for Mac or Windows. Fresh install from the official download page.',
  alternates: {
    canonical: `${env.siteUrl}/okvevo-download`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function OkVevoDownloadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
