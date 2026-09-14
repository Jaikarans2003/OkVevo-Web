'use client';

import Link from 'next/link';
import { Apple, Monitor } from 'lucide-react';
import NoiseOverlay from '@/components/shared/NoiseOverlay';
import Navbar from '@/components/landing-page/Navbar';
import Footer from '@/components/landing-page/Footer';
import { niaDownloadUrls } from '@/lib/nia-downloads';

const { mac: MAC_DOWNLOAD_URL, win: WINDOWS_DOWNLOAD_URL } = niaDownloadUrls();

export default function NiaDownloadPage() {
  return (
    <div className="min-h-screen bg-bg-main text-white">
      <NoiseOverlay />
      <Navbar />
      <main className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pb-24 pt-40 text-center">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-accent-orange">
          Desktop agent
        </p>
        <h1 className="mb-4 text-5xl font-black tracking-tight md:text-6xl">
          Hire Nia
        </h1>
        <p className="mb-14 max-w-xl text-lg text-white/50">
          Download Nia for Mac or Windows. Runs locally on your machine — no cloud workspace required.
        </p>

        <div className="grid w-full gap-6 sm:grid-cols-2">
          <a
            href={MAC_DOWNLOAD_URL}
            className="group flex flex-col items-center gap-4 rounded-[2rem] border border-white/10 bg-white/5 px-8 py-12 transition-all hover:border-accent-orange/50 hover:bg-white/10"
          >
            <Apple className="h-10 w-10 text-white/80 group-hover:text-accent-orange" strokeWidth={1.5} />
            <span className="text-xl font-bold">Mac</span>
            <span className="text-sm text-white/40">Download .dmg</span>
          </a>

          <a
            href={WINDOWS_DOWNLOAD_URL}
            className="group flex flex-col items-center gap-4 rounded-[2rem] border border-white/10 bg-white/5 px-8 py-12 transition-all hover:border-accent-orange/50 hover:bg-white/10"
          >
            <Monitor className="h-10 w-10 text-white/80 group-hover:text-accent-orange" strokeWidth={1.5} />
            <span className="text-xl font-bold">Windows</span>
            <span className="text-sm text-white/40">Download installer</span>
          </a>
        </div>

        <p className="mt-12 text-sm text-white/30">
          Already have an account?{' '}
          <Link href="/login" className="text-accent-orange hover:underline">
            Sign in
          </Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}
